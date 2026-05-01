use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use rti_core::bridge::{BridgeEvent, PanelDataSchema};
use rti_core::ingest::managed::{ManagedReceiverConfig, ManagedReceiverRuntime};
use rti_core::pcm::{bits_to_bytes, create_test_frame, frame_to_bits, PcmProfile};
use rti_core::stream::PanelSubscription;

fn socket_pair() -> (UdpSocket, UdpSocket, SocketAddr) {
    let receiver = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();
    let receiver_addr = receiver.local_addr().unwrap();
    let sender = UdpSocket::bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0)).unwrap();
    (receiver, sender, receiver_addr)
}

fn config() -> ManagedReceiverConfig {
    ManagedReceiverConfig {
        profile: PcmProfile::default(),
        capacity_per_channel: 16,
        data_namespace: "live".to_string(),
        subscriptions: vec![PanelSubscription {
            subscription_id: "sub-live".to_string(),
            panel_id: "panel-live".to_string(),
            channel_ids: vec![8001, 1205],
            schema: PanelDataSchema::TimeseriesV1,
        }],
        max_datagram_len: 4096,
        timeout: Duration::from_millis(10),
    }
}

fn wait_for_events(runtime: &ManagedReceiverRuntime, min_events: usize) -> Vec<BridgeEvent> {
    let deadline = Instant::now() + Duration::from_secs(1);
    loop {
        let events = runtime.drain_events();
        if events.len() >= min_events || Instant::now() >= deadline {
            return events;
        }
        thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn managed_receiver_loop_emits_panel_events_from_udp_datagrams() {
    let profile = PcmProfile::default();
    let (receiver, sender, receiver_addr) = socket_pair();
    let mut runtime = ManagedReceiverRuntime::start(receiver, config()).unwrap();
    let datagram = bits_to_bytes(&frame_to_bits(&create_test_frame(31, false, &profile), 3, &profile));

    sender.send_to(&datagram, receiver_addr).unwrap();
    let events = wait_for_events(&runtime, 1);
    runtime.stop().unwrap();

    assert!(events.iter().any(|event| matches!(event, BridgeEvent::PanelStreamData(_))));
    let snapshot = runtime.snapshot();
    assert!(!snapshot.running);
    assert_eq!(snapshot.accepted_frames, 1);
    assert_eq!(snapshot.rejected_frames, 0);
    assert!(snapshot.accepted_samples > 0);
}

#[test]
fn managed_receiver_loop_emits_crc_diagnostics_without_panel_events() {
    let profile = PcmProfile::default();
    let (receiver, sender, receiver_addr) = socket_pair();
    let mut runtime = ManagedReceiverRuntime::start(receiver, config()).unwrap();
    let datagram = bits_to_bytes(&frame_to_bits(&create_test_frame(32, true, &profile), 0, &profile));

    sender.send_to(&datagram, receiver_addr).unwrap();
    let events = wait_for_events(&runtime, 1);
    runtime.stop().unwrap();

    assert!(events.iter().any(|event| matches!(event, BridgeEvent::CrcEvent(_))));
    assert!(!events.iter().any(|event| matches!(event, BridgeEvent::PanelStreamData(_))));
    assert_eq!(runtime.snapshot().rejected_frames, 1);
}

#[test]
fn managed_receiver_loop_stop_joins_and_records_timeouts() {
    let (receiver, _sender, _receiver_addr) = socket_pair();
    let mut runtime = ManagedReceiverRuntime::start(receiver, config()).unwrap();

    thread::sleep(Duration::from_millis(35));
    runtime.stop().unwrap();

    let snapshot = runtime.snapshot();
    assert!(!snapshot.running);
    assert!(snapshot.timeout_count > 0);
}

#[test]
fn managed_receiver_loop_pushes_events_to_sink_without_drain() {
    let profile = PcmProfile::default();
    let (receiver, sender, receiver_addr) = socket_pair();
    let pushed_events = Arc::new(Mutex::new(Vec::new()));
    let sink_events = Arc::clone(&pushed_events);
    let mut runtime = ManagedReceiverRuntime::start_with_sink(receiver, config(), move |event| {
        sink_events.lock().unwrap().push(event);
    })
    .unwrap();
    let datagram = bits_to_bytes(&frame_to_bits(&create_test_frame(33, false, &profile), 0, &profile));

    sender.send_to(&datagram, receiver_addr).unwrap();
    let deadline = Instant::now() + Duration::from_secs(1);
    while pushed_events.lock().unwrap().is_empty() && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(10));
    }
    runtime.stop().unwrap();

    let events = pushed_events.lock().unwrap();
    assert!(events.iter().any(|event| matches!(event, BridgeEvent::PanelStreamData(_))));
}
