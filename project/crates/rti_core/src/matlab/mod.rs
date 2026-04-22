use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatlabEvidence {
    pub id: String,
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatlabMcpLaunchConfig {
    pub server_executable: PathBuf,
    pub matlab_root: Option<PathBuf>,
    pub initial_working_folder: PathBuf,
    pub log_folder: PathBuf,
    pub initialize_matlab_on_startup: bool,
    pub display_mode: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatlabMcpRunRequest {
    pub method: String,
    pub tool_name: String,
    pub arguments_json: String,
}

impl MatlabEvidence {
    pub fn new(id: impl Into<String>, label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            value: value.into(),
        }
    }
}

pub fn validate_script_path(workspace_root: &Path, script_path: &Path) -> Result<(), String> {
    if has_parent_component(workspace_root) || has_parent_component(script_path) {
        return Err("MATLAB script paths must not contain parent traversal".to_string());
    }
    if !script_path.starts_with(workspace_root) {
        return Err("MATLAB script path must stay within the workspace".to_string());
    }
    if script_path.extension().and_then(|ext| ext.to_str()) != Some("m") {
        return Err("MATLAB script path must use .m extension".to_string());
    }
    Ok(())
}

pub fn build_anomaly_bundle_script(run_id: &str, evidence: &[MatlabEvidence]) -> String {
    let mut script = String::new();
    script.push_str("% RealTimeInsight generated anomaly evidence bundle\n");
    script.push_str("clearvars;\n");
    script.push_str(&format!("run_id = '{}';\n", escape_matlab(run_id)));
    script.push_str("evidence = struct('id', {}, 'label', {}, 'value', {});\n");
    for (index, item) in evidence.iter().enumerate() {
        let row = index + 1;
        script.push_str(&format!(
            "evidence({row}).id = '{}'; evidence({row}).label = '{}'; evidence({row}).value = '{}';\n",
            escape_matlab(&item.id),
            escape_matlab(&item.label),
            escape_matlab(&item.value)
        ));
    }
    script.push_str("disp(['RTI anomaly bundle: ' run_id]);\n");
    script.push_str("disp({evidence.id}');\n");
    script
}

pub fn validate_generated_script(script: &str) -> Result<(), String> {
    let lowered = script.to_ascii_lowercase();
    let forbidden = ["!", "system(", "unix(", "dos(", "delete(", "rmdir(", "webread(", "urlread("];
    for token in forbidden {
        if lowered
            .lines()
            .any(|line| line.trim_start().starts_with(token) || line.contains(token))
        {
            return Err(format!("MATLAB script contains forbidden token: {token}"));
        }
    }
    Ok(())
}

pub fn build_matlab_mcp_launch_args(
    workspace_root: &Path,
    config: &MatlabMcpLaunchConfig,
) -> Result<Vec<String>, String> {
    validate_workspace_child_dir(workspace_root, &config.initial_working_folder, "initial working folder")?;
    validate_workspace_child_dir(workspace_root, &config.log_folder, "log folder")?;
    if config.display_mode != "nodesktop" && config.display_mode != "desktop" {
        return Err("MATLAB display mode must be desktop or nodesktop".to_string());
    }
    if config.server_executable.file_name().and_then(|name| name.to_str()) != Some("matlab-mcp-core-server") {
        return Err("MATLAB MCP executable must be matlab-mcp-core-server".to_string());
    }

    let mut args = vec![
        "--disable-telemetry".to_string(),
        "true".to_string(),
        "--initial-working-folder".to_string(),
        config.initial_working_folder.display().to_string(),
        "--log-folder".to_string(),
        config.log_folder.display().to_string(),
        "--matlab-display-mode".to_string(),
        config.display_mode.clone(),
        "--initialize-matlab-on-startup".to_string(),
        config.initialize_matlab_on_startup.to_string(),
    ];
    if let Some(matlab_root) = &config.matlab_root {
        if has_parent_component(matlab_root) {
            return Err("MATLAB root must not contain parent traversal".to_string());
        }
        args.push("--matlab-root".to_string());
        args.push(matlab_root.display().to_string());
    }
    Ok(args)
}

pub fn build_matlab_mcp_run_request(
    workspace_root: &Path,
    script_path: &Path,
) -> Result<MatlabMcpRunRequest, String> {
    validate_script_path(workspace_root, script_path)?;
    let escaped = escape_json(&script_path.display().to_string());
    Ok(MatlabMcpRunRequest {
        method: "tools/call".to_string(),
        tool_name: "run_matlab_file".to_string(),
        arguments_json: format!(
            "{{\"name\":\"run_matlab_file\",\"arguments\":{{\"script_path\":\"{}\"}}}}",
            escaped
        ),
    })
}

fn validate_workspace_child_dir(workspace_root: &Path, path: &Path, label: &str) -> Result<(), String> {
    if has_parent_component(path) {
        return Err(format!("MATLAB MCP {label} must not contain parent traversal"));
    }
    if !path.starts_with(workspace_root) {
        return Err(format!("MATLAB MCP {label} must stay within the workspace"));
    }
    Ok(())
}

fn has_parent_component(path: &Path) -> bool {
    path.components()
        .any(|component| matches!(component, Component::ParentDir))
}

fn escape_matlab(value: &str) -> String {
    value.replace('\'', "''")
}

fn escape_json(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}
