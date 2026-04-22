use std::path::PathBuf;

use rti_core::matlab::{
    build_anomaly_bundle_script, build_matlab_mcp_launch_args, build_matlab_mcp_run_request,
    validate_generated_script, validate_script_path, MatlabEvidence, MatlabMcpLaunchConfig,
};

#[test]
fn generated_matlab_script_stays_inside_workspace_and_mentions_evidence() {
    let workspace = PathBuf::from("/tmp/rti-workspace");
    let script_path = workspace.join("matlab").join("anomaly_bundle.m");
    let evidence = vec![
        MatlabEvidence::new("EVT-1", "Hydraulic spike", "+28 bar"),
        MatlabEvidence::new("CH-1002", "Bus current", "120 ms lead"),
    ];

    validate_script_path(&workspace, &script_path).expect("script path is allowed");
    let script = build_anomaly_bundle_script("run-0410", &evidence);
    validate_generated_script(&script).expect("script content is safe");

    assert!(script.contains("EVT-1"));
    assert!(script.contains("CH-1002"));
    assert!(script.contains("run-0410"));
}

#[test]
fn matlab_boundary_rejects_escape_shell_and_outside_paths() {
    let workspace = PathBuf::from("/tmp/rti-workspace");
    let outside = PathBuf::from("/tmp/outside.m");
    let unsafe_script = "disp('x'); !rm -rf /";

    assert!(validate_script_path(&workspace, &outside).is_err());
    assert!(validate_generated_script(unsafe_script).is_err());
}

#[test]
fn matlab_mcp_launch_args_are_allowlisted_and_workspace_scoped() {
    let workspace = PathBuf::from("/tmp/rti-workspace");
    let config = MatlabMcpLaunchConfig {
        server_executable: PathBuf::from("/home/eta/.local/bin/matlab-mcp-core-server"),
        matlab_root: Some(PathBuf::from("/usr/local/MATLAB/R2026a")),
        initial_working_folder: workspace.join("matlab"),
        log_folder: workspace.join("logs").join("matlab-mcp"),
        initialize_matlab_on_startup: false,
        display_mode: "nodesktop".to_string(),
    };

    let args = build_matlab_mcp_launch_args(&workspace, &config).expect("launch args are safe");

    assert_eq!(args[0], "--disable-telemetry");
    assert!(args.contains(&"--initial-working-folder".to_string()));
    assert!(args.contains(&workspace.join("matlab").display().to_string()));
    assert!(args.contains(&"--matlab-display-mode".to_string()));
    assert!(args.contains(&"nodesktop".to_string()));
}

#[test]
fn matlab_mcp_run_request_contains_safe_script_path() {
    let workspace = PathBuf::from("/tmp/rti-workspace");
    let script_path = workspace.join("matlab").join("anomaly_bundle.m");

    let request = build_matlab_mcp_run_request(&workspace, &script_path).unwrap();

    assert_eq!(request.method, "tools/call");
    assert_eq!(request.tool_name, "run_matlab_file");
    assert!(request.arguments_json.contains("anomaly_bundle.m"));
    assert!(build_matlab_mcp_run_request(&workspace, &PathBuf::from("/tmp/outside.m")).is_err());
}
