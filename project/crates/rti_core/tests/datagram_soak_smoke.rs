use std::time::{Duration, Instant};

use rti_core::bridge::PanelDataSchema;
use rti_core::data_ref::DataRefRegistry;
use rti_core::ingest::pipeline::ingest_pcm_datagram;
use rti_core::ingest::IngestStore;
use rti_core::pcm::{bits_to_bytes, create_test_frame, frame_to_bits, PcmProfile};
use rti_core::stream::{build_panel_event_batch, PanelSubscription};

fn frames_for_profile(mbps: u32, frame_bytes: usize, duration: Duration) -> usize {
    let bits = mbps as f64 * 1_000_000.0 * duration.as_secs_f64();
    (bits / (frame_bytes as f64 * 8.0)).ceil() as usize
}

#[test]
fn soaks_30_mbps_ingest_event_path_when_enabled() {
    if std::env::var("RUN_SOAK_SMOKE").ok().as_deref() != Some("1") {
        eprintln!("Datagram soak smoke skipped; set RUN_SOAK_SMOKE=1 to run.");
        return;
    }
    assert!(
        cfg!(not(debug_assertions)),
        "soak smoke must run with cargo test --release"
    );

    let profile = PcmProfile::default();
    let frame_bytes = profile.frame_words * profile.word_bits / 8;
    let frame_count = frames_for_profile(30, frame_bytes, Duration::from_secs(2));
    let mut store = IngestStore::new(frame_count * 2);
    let mut registry = DataRefRegistry::new("soak");
    let subscriptions = vec![PanelSubscription {
        subscription_id: "sub-soak".to_string(),
        panel_id: "panel-soak".to_string(),
        channel_ids: vec![8001, 1205],
        schema: PanelDataSchema::TimeseriesV1,
    }];

    let started = Instant::now();
    for chunk in 0..20 {
        let mut bits = Vec::new();
        for offset in 0..(frame_count / 20) {
            let counter = (chunk * (frame_count / 20) + offset) as u32;
            bits.extend(frame_to_bits(
                &create_test_frame(counter, counter % 211 == 0, &profile),
                (counter as usize) % profile.word_bits,
                &profile,
            ));
        }
        let datagram = bits_to_bytes(&bits);
        let report = ingest_pcm_datagram(&mut store, &datagram, &profile);
        let batch = build_panel_event_batch(&mut registry, &store, &subscriptions, chunk as u64);
        assert_eq!(batch.events.len(), 1);
        assert!(report.stats.sync_matches > 0);
    }
    let elapsed = started.elapsed();
    let stats = store.stats();

    assert!(stats.accepted_frames > 5_000);
    assert!(stats.rejected_frames > 0);
    assert!(stats.accepted_samples > 60_000);
    assert!(
        elapsed < Duration::from_secs(2),
        "2s equivalent 30 Mbps soak should process under 2s, got {:?}",
        elapsed
    );
    eprintln!(
        "30 Mbps 2s soak: accepted={} rejected={} samples={} elapsed={:?}",
        stats.accepted_frames, stats.rejected_frames, stats.accepted_samples, elapsed
    );
}
