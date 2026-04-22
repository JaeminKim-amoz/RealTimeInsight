use std::path::PathBuf;

use rti_core::matlab::build_anomaly_bundle_script;
use rti_core::runtime_policy::{
    authorize_air_gapped_action, authorize_executable, authorize_matlab_script,
    build_gstreamer_seek_args, reject_raw_shell_launcher, RuntimeActionClass, RuntimeExecutable,
};

#[test]
fn only_allowlisted_runtime_executables_are_authorized() {
    assert_eq!(
        authorize_executable("matlab-mcp-core-server"),
        Ok(RuntimeExecutable::MatlabMcpCoreServer)
    );
    assert_eq!(authorize_executable("ollama"), Ok(RuntimeExecutable::Ollama));
    assert_eq!(
        authorize_executable("simdis-sidecar"),
        Ok(RuntimeExecutable::SimdisSidecar)
    );
    assert_eq!(
        authorize_executable("gst-launch-1.0"),
        Ok(RuntimeExecutable::Gstreamer)
    );
    assert!(authorize_executable("cmd.exe").is_err());
    assert!(authorize_executable("https://example.com/tool").is_err());
}

#[test]
fn gstreamer_seek_args_are_local_and_shell_free() {
    let args = build_gstreamer_seek_args("project/runtime/assets/video/sortie-0410.ts", 182_340_000_000).unwrap();

    assert!(args.contains(&"filesrc".to_string()));
    assert!(args.iter().any(|arg| arg == "location=project/runtime/assets/video/sortie-0410.ts"));
    assert!(args.contains(&"appsink".to_string()));
    assert!(build_gstreamer_seek_args("../escape.ts", 1).is_err());
    assert!(build_gstreamer_seek_args("https://example.com/video.ts", 1).is_err());
}

#[test]
fn raw_shell_launchers_urls_and_command_flags_are_rejected() {
    assert!(reject_raw_shell_launcher("powershell", &[]).is_err());
    assert!(reject_raw_shell_launcher("bash", &["-c", "echo hi"]).is_err());
    assert!(reject_raw_shell_launcher("ollama", &["https://example.com/model"]).is_err());
    assert!(reject_raw_shell_launcher("ollama", &["run", "gemma4:31b"]).is_ok());
}

#[test]
fn matlab_script_authorization_reuses_path_and_content_safety() {
    let workspace = PathBuf::from("/tmp/rti");
    let safe_script_path = workspace.join("matlab").join("bundle.m");
    let script = build_anomaly_bundle_script("run-1", &[]);

    assert!(authorize_matlab_script(&workspace, &safe_script_path, &script).is_ok());
    assert!(authorize_matlab_script(&workspace, &PathBuf::from("/tmp/outside.m"), &script).is_err());
    assert!(authorize_matlab_script(&workspace, &safe_script_path, "!rm -rf /").is_err());
}

#[test]
fn air_gapped_profile_rejects_online_actions() {
    assert!(authorize_air_gapped_action(RuntimeActionClass::LocalOnly).is_ok());
    assert!(authorize_air_gapped_action(RuntimeActionClass::InternetFetch).is_err());
    assert!(authorize_air_gapped_action(RuntimeActionClass::CloudAction).is_err());
}
