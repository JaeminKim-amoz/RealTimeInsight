use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

use rti_core::bridge::{BridgeEvent, PanelDataSchema};
use rti_core::ingest::receiver::ReceiverSession;
use rti_core::pcm::{bits_to_bytes, create_test_frame, frame_to_bits, PcmProfile};
use rti_core::stream::PanelSubscription;

fn socket_pair() -> (UdpSocket, UdpSocket, SocketAddr) {
    let receiver = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();
    let receiver_addr = receiver.local_addr().unwrap();
    let sender = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();
    (receiver, sender, receiver_addr)
}

#[test]
fn corrupt_crc_datagram_emits_crc_diagnostic_without_panel_samples() {
    let profile = PcmProfile::default();
    let (receiver, sender, receiver_addr) = socket_pair();
    let mut session = ReceiverSession::new(
        profile.clone(),
        8,
        "live",
        vec![PanelSubscription {
            subscription_id: "sub-live".to_string(),
            panel_id: "panel-live".to_string(),
            channel_ids: vec![8001],
            schema: PanelDataSchema::TimeseriesV1,
        }],
    );
    let datagram = bits_to_bytes(&frame_to_bits(&create_test_frame(22, true, &profile), 0, &profile));
    sender.send_to(&datagram, receiver_addr).unwrap();

    let tick = session.tick(&receiver, 4096, Duration::from_secs(1)).unwrap();

    assert_eq!(tick.ingest_report.stats.bad_frames, 1);
    assert!(tick.panel_batch.events.is_empty());
    match &tick.diagnostic_events[0] {
        BridgeEvent::CrcEvent(payload) => {
            assert_eq!(payload.frame_counter, 22);
            assert!(payload.channel_ids.contains(&8001));
            assert_eq!(payload.reason, "crc-fail");
        }
        _ => panic!("expected crc event"),
    }
}

#[test]
fn no_sync_datagram_emits_sync_loss_and_does_not_advance_sequence() {
    let profile = PcmProfile::default();
    let (receiver, sender, receiver_addr) = socket_pair();
    let mut session = ReceiverSession::new(profile, 8, "live", vec![]);
    sender.send_to(&[0xAA, 0x55, 0xAA, 0x55], receiver_addr).unwrap();

    let tick = session.tick(&receiver, 4096, Duration::from_secs(1)).unwrap();

    assert!(tick.ingest_report.sync_lost);
    assert_eq!(session.next_seq, 1);
    assert!(matches!(tick.diagnostic_events[0], BridgeEvent::SyncLossEvent(_)));
}
