use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

use rti_core::bridge::{BridgeEvent, PanelDataSchema};
use rti_core::data_ref::DataRefRegistry;
use rti_core::ingest::receiver::receive_decode_and_build_events;
use rti_core::ingest::IngestStore;
use rti_core::pcm::{bits_to_bytes, create_test_frame, frame_to_bits, PcmProfile};
use rti_core::stream::PanelSubscription;

#[test]
fn receiver_tick_builds_panel_event_from_udp_datagram() {
    let profile = PcmProfile::default();
    let receiver = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();
    let receiver_addr = receiver.local_addr().unwrap();
    let sender = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();
    let datagram = bits_to_bytes(&frame_to_bits(&create_test_frame(33, false, &profile), 4, &profile));
    sender.send_to(&datagram, receiver_addr).unwrap();

    let mut store = IngestStore::new(8);
    let mut registry = DataRefRegistry::new("live");
    let subscriptions = vec![PanelSubscription {
        subscription_id: "sub-live".to_string(),
        panel_id: "panel-live".to_string(),
        channel_ids: vec![8001, 1205],
        schema: PanelDataSchema::TimeseriesV1,
    }];

    let tick = receive_decode_and_build_events(
        &receiver,
        4096,
        Duration::from_secs(1),
        &profile,
        &mut store,
        &mut registry,
        &subscriptions,
        9,
    ).unwrap();

    assert_eq!(tick.ingest_report.stats.good_frames, 1);
    assert_eq!(tick.ingest_report.accepted_frames, 1);
    assert_eq!(tick.panel_batch.events.len(), 1);
    match &tick.panel_batch.events[0] {
        BridgeEvent::PanelStreamData(payload) => {
            assert_eq!(payload.subscription_id, "sub-live");
            assert_eq!(payload.seq, 9);
            assert!(registry.get(&payload.data_ref).is_some());
        }
        _ => panic!("expected panel stream event"),
    }
}
