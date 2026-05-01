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
fn receiver_session_increments_event_sequence_across_ticks() {
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

    for counter in [1, 2] {
        let datagram = bits_to_bytes(&frame_to_bits(&create_test_frame(counter, false, &profile), 0, &profile));
        sender.send_to(&datagram, receiver_addr).unwrap();
        let tick = session.tick(&receiver, 4096, Duration::from_secs(1)).unwrap();
        match &tick.panel_batch.events[0] {
            BridgeEvent::PanelStreamData(payload) => assert_eq!(payload.seq, counter as u64),
            _ => panic!("expected panel event"),
        }
    }

    assert_eq!(session.next_seq, 3);
    assert_eq!(session.store.stats().accepted_frames, 2);
    assert_eq!(session.registry.len(), 2);
}

#[test]
fn receiver_session_counts_timeouts() {
    let profile = PcmProfile::default();
    let (receiver, _sender, _receiver_addr) = socket_pair();
    let mut session = ReceiverSession::new(profile, 8, "live", vec![]);

    let result = session.tick(&receiver, 4096, Duration::from_millis(10));

    assert!(result.is_err());
    assert_eq!(session.timeout_count, 1);
}
