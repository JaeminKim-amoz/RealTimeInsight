use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

use rti_core::simdis::{
    build_sidecar_launch_args, decode_entity_state_pdu, missing_sidecar_diagnostic,
    profile_to_json, publish_entity_state_update, sidecar_status_from_profile,
    validate_bridge_profile, DisValidationProfile, EntityId, EntityState, SimdisBridgeProfile,
    SimdisSidecarHealth,
};

fn entity() -> EntityState {
    EntityState {
        exercise_id: 7,
        entity_id: EntityId {
            site: 1,
            application: 42,
            entity: 900,
        },
        force_id: 1,
        timestamp: 123_456,
        location: [127.123, 36.456, 3500.0],
        velocity: [210.0, -3.5, 0.25],
        orientation: [0.1, 0.2, 0.3],
    }
}

fn profile(target: SocketAddr) -> SimdisBridgeProfile {
    SimdisBridgeProfile {
        name: "local-simdis".to_string(),
        target,
        publish_rate_hz: 20,
        sidecar_executable: None,
        sdk_path: Some("project/vendor/simdissdk".into()),
        log_dir: "project/runtime/logs/simdis".into(),
        heartbeat_timeout_ms: 1_000,
        validation: DisValidationProfile {
            allowed_entity_range: None,
            max_pdus_per_second: 20,
        },
    }
}

#[test]
fn simdis_bridge_profile_requires_20hz_and_valid_endpoint() {
    let target = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 30_000);
    let mut good = profile(target);

    validate_bridge_profile(&good).expect("20Hz local profile is valid");

    good.publish_rate_hz = 19;
    assert!(validate_bridge_profile(&good).unwrap_err().contains(">=20Hz"));
    good.publish_rate_hz = 20;
    good.target = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0);
    assert!(validate_bridge_profile(&good).unwrap_err().contains("port"));
}

#[test]
fn sdk_baseline_without_sidecar_is_degraded_not_fatal() {
    let status = sidecar_status_from_profile(&profile(SocketAddr::new(
        IpAddr::V4(Ipv4Addr::LOCALHOST),
        30_000,
    )));

    assert_eq!(
        status,
        SimdisSidecarHealth::Degraded("sidecar executable missing; SDK baseline configured".to_string())
    );
}

#[test]
fn publishes_entity_state_pdu_to_local_udp_receiver() {
    let receiver = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();
    receiver.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
    let target = receiver.local_addr().unwrap();
    let sender = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();
    let profile = profile(target);

    let sent = publish_entity_state_update(&sender, &profile, &entity()).unwrap();

    let mut bytes = vec![0u8; 256];
    let (len, _) = receiver.recv_from(&mut bytes).unwrap();
    bytes.truncate(len);
    let decoded = decode_entity_state_pdu(&bytes).unwrap();

    assert_eq!(sent, 144);
    assert_eq!(decoded.entity_id, entity().entity_id);
    assert_eq!(decoded.location, entity().location);
}

#[test]
fn builds_sidecar_launch_args_and_profile_json() {
    let mut profile = profile(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 30_000));
    profile.sidecar_executable = Some("/opt/simdis/bin/simdis-sidecar".into());

    let args = build_sidecar_launch_args(&profile).expect("sidecar launch args are safe");
    let json = profile_to_json(&profile).expect("profile serializes");

    assert_eq!(args[0], "--profile-json");
    assert!(args[1].contains("local-simdis"));
    assert!(args.contains(&"--log-dir".to_string()));
    assert!(json.contains("\"publishRateHz\":20"));
    assert!(json.contains("\"target\":\"127.0.0.1:30000\""));
}

#[test]
fn sidecar_launch_accepts_linux_and_windows_executable_paths() {
    let mut linux = profile(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 30_000));
    linux.sidecar_executable = Some("/opt/simdis/bin/simdis-sidecar".into());
    assert!(build_sidecar_launch_args(&linux).is_ok());

    let mut windows = profile(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 30_000));
    windows.sidecar_executable = Some(r"C:\Program Files\SIMDIS\simdis.exe".into());
    assert!(build_sidecar_launch_args(&windows).is_ok());

    let mut unsafe_shell = profile(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 30_000));
    unsafe_shell.sidecar_executable = Some("powershell.exe".into());
    assert!(build_sidecar_launch_args(&unsafe_shell).is_err());

    let mut unsafe_url = profile(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 30_000));
    unsafe_url.sidecar_executable = Some("https://example.com/simdis.exe".into());
    assert!(build_sidecar_launch_args(&unsafe_url).is_err());
}

#[test]
fn missing_sidecar_diagnostic_prefers_sdk_baseline_context() {
    let diagnostic = missing_sidecar_diagnostic(&profile(SocketAddr::new(
        IpAddr::V4(Ipv4Addr::LOCALHOST),
        30_000,
    )));

    assert!(diagnostic.contains("sidecar executable missing"));
    assert!(diagnostic.contains("project/vendor/simdissdk"));
}
