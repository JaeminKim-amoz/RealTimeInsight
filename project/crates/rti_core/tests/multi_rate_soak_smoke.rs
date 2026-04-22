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

fn run_profile(mbps: u32, duration: Duration) -> (u64, u64, u64, Duration) {
    let profile = PcmProfile::default();
    let frame_bytes = profile.frame_words * profile.word_bits / 8;
    let frame_count = frames_for_profile(mbps, frame_bytes, duration);
    let chunks = 20usize;
    let frames_per_chunk = frame_count / chunks;
    let mut store = IngestStore::new(frame_count * 2);
    let mut registry = DataRefRegistry::new(format!("soak-{mbps}"));
    let subscriptions = vec![PanelSubscription {
        subscription_id: format!("sub-soak-{mbps}"),
        panel_id: format!("panel-soak-{mbps}"),
        channel_ids: vec![8001, 1205],
        schema: PanelDataSchema::TimeseriesV1,
    }];

    let started = Instant::now();
    for chunk in 0..chunks {
        let mut bits = Vec::new();
        for offset in 0..frames_per_chunk {
            let counter = (chunk * frames_per_chunk + offset) as u32;
            bits.extend(frame_to_bits(
                &create_test_frame(counter, counter % 251 == 0, &profile),
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
    (
        stats.accepted_frames,
        stats.rejected_frames,
        stats.accepted_samples,
        elapsed,
    )
}

#[test]
fn soaks_10_20_30_mbps_ingest_event_path_when_enabled() {
    if std::env::var("RUN_MULTI_RATE_SOAK").ok().as_deref() != Some("1") {
        eprintln!("Multi-rate soak smoke skipped; set RUN_MULTI_RATE_SOAK=1 to run.");
        return;
    }
    assert!(
        cfg!(not(debug_assertions)),
        "multi-rate soak smoke must run with cargo test --release"
    );

    for mbps in [10, 20, 30] {
        let (accepted, rejected, samples, elapsed) = run_profile(mbps, Duration::from_secs(2));
        assert!(accepted > 1_900, "{mbps} Mbps accepted frames too low: {accepted}");
        assert!(rejected > 0, "{mbps} Mbps should include rejected CRC frames");
        assert!(samples > 25_000, "{mbps} Mbps accepted samples too low: {samples}");
        assert!(
            elapsed < Duration::from_secs(2),
            "{mbps} Mbps 2s equivalent soak should process under 2s, got {:?}",
            elapsed
        );
        eprintln!(
            "{mbps} Mbps 2s soak: accepted={accepted} rejected={rejected} samples={samples} elapsed={elapsed:?}"
        );
    }
}
