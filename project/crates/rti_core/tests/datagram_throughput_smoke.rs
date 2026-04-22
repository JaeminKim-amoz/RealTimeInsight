use std::time::{Duration, Instant};

use rti_core::data_ref::DataRefRegistry;
use rti_core::ingest::pipeline::ingest_pcm_datagram;
use rti_core::ingest::IngestStore;
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
