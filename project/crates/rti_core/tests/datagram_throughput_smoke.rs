use std::net::{SocketAddr, UdpSocket};
use std::time::{Duration, Instant};

use rti_core::data_ref::DataRefRegistry;
use rti_core::ingest::managed::{ManagedReceiverConfig, ManagedReceiverRuntime};
use rti_core::ingest::pipeline::ingest_pcm_datagram;
use rti_core::ingest::IngestStore;
use rti_core::pcm::generator::PcmGenerator;
use rti_core::pcm::{bits_to_bytes, create_test_frame, frame_to_bits, PcmProfile};
use rti_core::stream::{build_panel_event_batch, PanelSubscription};
use rti_core::bridge::PanelDataSchema;

fn frames_for_profile(mbps: u32, frame_bytes: usize, duration: Duration) -> usize {
    let bits = mbps as f64 * 1_000_000.0 * duration.as_secs_f64();
    (bits / (frame_bytes as f64 * 8.0)).ceil() as usize
}

#[test]
fn ingests_and_builds_events_for_30_mbps_profile_when_enabled() {
    if std::env::var("RUN_PERF_SMOKE").ok().as_deref() != Some("1") {
        eprintln!("Datagram throughput smoke skipped; set RUN_PERF_SMOKE=1 to run.");
        return;
    }
    assert!(
        cfg!(not(debug_assertions)),
        "performance smoke must run with cargo test --release"
    );

    let profile = PcmProfile::default();
    let frame_bytes = profile.frame_words * profile.word_bits / 8;
    let frame_count = frames_for_profile(30, frame_bytes, Duration::from_millis(250));
    let mut bits = Vec::new();
    for counter in 0..frame_count as u32 {
        bits.extend(frame_to_bits(
            &create_test_frame(counter, counter % 97 == 0, &profile),
            (counter as usize) % profile.word_bits,
            &profile,
        ));
    }
    let datagram = bits_to_bytes(&bits);
    let mut store = IngestStore::new(frame_count * 2);
    let mut registry = DataRefRegistry::new("perf");
    let subscriptions = vec![PanelSubscription {
        subscription_id: "sub-perf".to_string(),
        panel_id: "panel-perf".to_string(),
        channel_ids: vec![8001, 1205],
        schema: PanelDataSchema::TimeseriesV1,
    }];

    let started = Instant::now();
    let report = ingest_pcm_datagram(&mut store, &datagram, &profile);
    let batch = build_panel_event_batch(&mut registry, &store, &subscriptions, 1);
    let elapsed = started.elapsed();

    assert_eq!(report.stats.sync_matches, frame_count);
    assert_eq!(report.stats.bad_frames, 8);
    assert_eq!(report.stats.good_frames, frame_count - 8);
    assert_eq!(batch.events.len(), 1);
    assert!(registry.len() == 1);
    assert!(
        elapsed < Duration::from_millis(250),
        "30 Mbps datagram ingest+event path should stay below 250ms, got {:?}",
        elapsed
    );
    eprintln!("30 Mbps ingest+event profile: {frame_count} frames in {:?}", elapsed);
}

/// Slice-1 strict gate: 10 Mbps UDP loopback for TEST_DURATION_SECS seconds, zero loss.
///
/// Gated behind `RUN_PERF_SMOKE=1`. Duration defaults to 60 s but can be
/// overridden via `PERF_DURATION_SECS` for fast local smoke (e.g. set to 1).
/// CI always uses the full 60-second gate.
///
/// Byte-rate assertion: accepted_frames × bytes_per_frame / elapsed_secs must
/// lie within [9.5e6, 10.5e6] bytes/sec (matches the 10 Mbps target).
/// Loss assertion: rejected_frames == 0 and timeout_count == 0.
#[test]
#[ignore]
fn slice1_strict_10mbps_60s_zero_loss() {
    if std::env::var("RUN_PERF_SMOKE").ok().as_deref() != Some("1") {
        eprintln!("slice1_strict_10mbps_60s_zero_loss: skipped (set RUN_PERF_SMOKE=1 to run)");
        return;
    }

    const DEFAULT_DURATION_SECS: u64 = 60;
    let test_duration_secs: u64 = std::env::var("PERF_DURATION_SECS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(DEFAULT_DURATION_SECS);
    let test_duration = Duration::from_secs(test_duration_secs);

    const BITRATE_MBPS: f64 = 10.0;

    let profile = PcmProfile::default();
    let bytes_per_frame = profile.frame_words * profile.word_bits / 8;

    // Bind the receiver socket on an OS-assigned ephemeral port.
    let recv_socket = UdpSocket::bind("127.0.0.1:0")
        .expect("failed to bind receiver socket");
    let recv_addr: SocketAddr = recv_socket.local_addr()
        .expect("failed to get receiver local_addr");

    // Start the managed receiver runtime on the bound socket.
    let managed_config = ManagedReceiverConfig {
        profile: profile.clone(),
        capacity_per_channel: 4096,
        data_namespace: "slice1-perf".to_string(),
        subscriptions: vec![],
        max_datagram_len: bytes_per_frame * 2,
        timeout: Duration::from_millis(200),
    };
    let mut runtime = ManagedReceiverRuntime::start(recv_socket, managed_config)
        .expect("failed to start ManagedReceiverRuntime");

    // Spawn sender thread: PcmGenerator drives UDP sends at 10 Mbps.
    let sender_profile = profile.clone();
    let send_handle = std::thread::spawn(move || {
        let send_socket = UdpSocket::bind("127.0.0.1:0")
            .expect("sender: failed to bind send socket");
        let mut gen = PcmGenerator::new(sender_profile, vec![1001], BITRATE_MBPS);

        let tick_secs = if gen.target_frame_rate_hz() > 0.0 {
            1.0 / gen.target_frame_rate_hz()
        } else {
            0.001
        };
        let tick_dur = Duration::from_secs_f64(tick_secs);

        let start = Instant::now();
        let mut next_tick = start;
        while start.elapsed() < test_duration {
            let frame = gen.step_bytes();
            let _ = send_socket.send_to(&frame, recv_addr);
            next_tick += tick_dur;
            let now = Instant::now();
            if next_tick > now {
                std::thread::sleep(next_tick - now);
            }
        }
    });

    // Wait for sender to finish, then allow a short drain window before stopping.
    send_handle.join().expect("sender thread panicked");
    std::thread::sleep(Duration::from_millis(500));

    runtime.stop().expect("failed to stop ManagedReceiverRuntime");
    let snap = runtime.snapshot();

    let elapsed_secs = test_duration.as_secs_f64();
    let accepted_bytes = snap.accepted_frames * bytes_per_frame as u64;
    // Express as bits/sec to match the "10 Mbps" naming convention.
    let bitrate_bps = accepted_bytes as f64 * 8.0 / elapsed_secs;

    eprintln!(
        "slice1_strict_10mbps_60s_zero_loss: accepted_frames={} rejected_frames={} timeout_count={} bitrate={:.3e} bps elapsed={}s",
        snap.accepted_frames, snap.rejected_frames, snap.timeout_count, bitrate_bps, test_duration_secs,
    );

    assert!(
        (9.5e6..=10.5e6).contains(&bitrate_bps),
        "bitrate {:.3e} bps out of [9.5e6, 10.5e6] bps window (10 Mbps ±5%)",
        bitrate_bps,
    );
    assert_eq!(
        snap.rejected_frames, 0,
        "expected 0 rejected frames (CRC failures), got {}",
        snap.rejected_frames,
    );
    assert_eq!(
        snap.timeout_count, 0,
        "expected 0 timeouts (dropped datagrams), got {}",
        snap.timeout_count,
    );
}
