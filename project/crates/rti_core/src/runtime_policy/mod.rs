use std::path::{Component, Path};

use crate::matlab::{validate_generated_script, validate_script_path};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeExecutable {
    MatlabMcpCoreServer,
    Ollama,
    SimdisSidecar,
    Gstreamer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeActionClass {
    LocalOnly,
    InternetFetch,
    CloudAction,
}

pub fn authorize_executable(id: &str) -> Result<RuntimeExecutable, String> {
    match id {
        "matlab-mcp-core-server" => Ok(RuntimeExecutable::MatlabMcpCoreServer),
        "ollama" => Ok(RuntimeExecutable::Ollama),
        "simdis-sidecar" => Ok(RuntimeExecutable::SimdisSidecar),
        "gst-launch-1.0" | "gst-inspect-1.0" => Ok(RuntimeExecutable::Gstreamer),
        _ => Err(format!("runtime executable is not allowlisted: {id}")),
    }
}

pub fn reject_raw_shell_launcher(executable: &str, args: &[&str]) -> Result<(), String> {
    let lowered = executable.to_ascii_lowercase();
    let shell_names = ["cmd.exe", "powershell", "pwsh", "bash", "sh"];
    if shell_names.iter().any(|name| lowered.ends_with(name)) {
        return Err("raw shell launchers are not allowed".to_string());
    }
    if args.iter().any(|arg| *arg == "-c" || *arg == "/c") {
        return Err("shell command flags are not allowed".to_string());
    }
    if args.iter().any(|arg| arg.starts_with("http://") || arg.starts_with("https://")) {
        return Err("runtime command arguments must not be arbitrary URLs".to_string());
    }
    Ok(())
}

pub fn authorize_matlab_script(
    workspace_root: &Path,
    script_path: &Path,
    script: &str,
) -> Result<(), String> {
    validate_script_path(workspace_root, script_path)?;
    validate_generated_script(script)?;
    Ok(())
}

pub fn authorize_air_gapped_action(action: RuntimeActionClass) -> Result<(), String> {
    match action {
        RuntimeActionClass::LocalOnly => Ok(()),
        RuntimeActionClass::InternetFetch | RuntimeActionClass::CloudAction => {
            Err("air-gapped profile rejects internet fetch and cloud actions".to_string())
        }
    }
}

pub fn build_gstreamer_seek_args(source: &str, cursor_ns: u64) -> Result<Vec<String>, String> {
    reject_local_media_path(source)?;
    Ok(vec![
        "filesrc".to_string(),
        format!("location={source}"),
        "!".to_string(),
        "tsdemux".to_string(),
        "!".to_string(),
        "h264parse".to_string(),
        "!".to_string(),
        "appsink".to_string(),
        format!("rti-cursor-ns={cursor_ns}"),
    ])
}

fn reject_local_media_path(source: &str) -> Result<(), String> {
    if source.trim().is_empty() {
        return Err("GStreamer source path must not be empty".to_string());
    }
    if source.starts_with("http://") || source.starts_with("https://") {
        return Err("GStreamer source path must be local".to_string());
    }
    let path = Path::new(source);
    if path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("GStreamer source path must be relative and stay within the workspace".to_string());
    }
    if !source.to_ascii_lowercase().ends_with(".ts") && !source.to_ascii_lowercase().ends_with(".mts") {
        return Err("GStreamer source path must be MPEG-TS".to_string());
    }
    Ok(())
}
