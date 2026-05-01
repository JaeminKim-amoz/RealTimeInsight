use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

use rti_core::ingest::udp::{
    bind_receiver, default_pcm_udp_config, receive_datagram, UdpMode, UdpReceiverConfig,
};

#[test]
fn default_pcm_udp_config_matches_first_vertical_slice() {
    let cfg = default_pcm_udp_config();

    assert_eq!(cfg.mode, UdpMode::Multicast);
    assert_eq!(cfg.bind_addr().unwrap(), SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), 5001));
    assert_eq!(cfg.multicast_group, Some(IpAddr::V4(Ipv4Addr::new(239, 192, 1, 10))));
    assert_eq!(cfg.expected_bitrate_mbps, 30);
}

#[test]
fn rejects_invalid_bitrate_profile() {
    let mut cfg = default_pcm_udp_config();
    cfg.expected_bitrate_mbps = 31;

    assert!(cfg.validate().unwrap_err().contains("expected_bitrate_mbps"));
}

#[test]
fn rejects_non_multicast_group_for_multicast_mode() {
    let mut cfg = default_pcm_udp_config();
    cfg.multicast_group = Some(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1)));

    assert!(cfg.validate().unwrap_err().contains("multicast"));
}

#[test]
fn accepts_unicast_without_multicast_group() {
    let cfg = UdpReceiverConfig {
        mode: UdpMode::Unicast,
        bind_ip: IpAddr::V4(Ipv4Addr::LOCALHOST),
        bind_port: 5500,
        source_ip: Some(IpAddr::V4(Ipv4Addr::new(10, 1, 1, 50))),
        multicast_group: None,
        expected_bitrate_mbps: 10,
    };

    assert_eq!(cfg.bind_addr().unwrap(), SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 5500));
}

#[test]
fn receives_local_udp_datagram() {
    let receiver_cfg = UdpReceiverConfig {
        mode: UdpMode::Unicast,
        bind_ip: IpAddr::V4(Ipv4Addr::LOCALHOST),
        bind_port: 0,
        source_ip: None,
        multicast_group: None,
        expected_bitrate_mbps: 10,
    };
    let socket = UdpSocket::bind(SocketAddr::new(receiver_cfg.bind_ip, 0)).unwrap();
    let receiver_addr = socket.local_addr().unwrap();
    let sender = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();

    sender.send_to(&[0xFE, 0x6B, 0x28, 0x40], receiver_addr).unwrap();

    let payload = receive_datagram(&socket, 64, Duration::from_secs(1)).unwrap();
    assert_eq!(payload, vec![0xFE, 0x6B, 0x28, 0x40]);
}

#[test]
fn bind_receiver_rejects_invalid_config() {
    let mut cfg = default_pcm_udp_config();
    cfg.bind_port = 0;

    assert!(bind_receiver(&cfg).is_err());
}
