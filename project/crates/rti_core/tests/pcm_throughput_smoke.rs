use std::time::{Duration, Instant};

use rti_core::pcm::{create_test_frame, decode_bitstream, frame_to_bits, PcmProfile};

fn frames_for_profile(mbps: u32, frame_bytes: usize, duration: Duration) -> usize {
    let bits = mbps as f64 * 1_000_000.0 * duration.as_secs_f64();
    (bits / (frame_bytes as f64 * 8.0)).ceil() as usize
}

#[test]
fn decodes_10_20_30_mbps_profiles_when_enabled() {
    if std::env::var("RUN_PERF_SMOKE").ok().as_deref() != Some("1") {
        eprintln!("PCM throughput smoke skipped; set RUN_PERF_SMOKE=1 to run.");
        return;
    }
    assert!(
        cfg!(not(debug_assertions)),
        "performance smoke must run with cargo test --release"
    );

    let profile = PcmProfile::default();
    let frame_bytes = profile.frame_words * profile.word_bits / 8;
    let duration = Duration::from_millis(250);

    for mbps in [10, 20, 30] {
        let frame_count = frames_for_profile(mbps, frame_bytes, duration);
        let mut bits = Vec::new();
        for counter in 0..frame_count as u32 {
            bits.extend(frame_to_bits(
                &create_test_frame(counter, false, &profile),
                (counter as usize) % profile.word_bits,
                &profile,
            ));
        }

        let started = Instant::now();
        let decoded = decode_bitstream(&bits, &profile);
        let elapsed = started.elapsed();

        assert_eq!(decoded.stats.sync_matches, frame_count);
        assert_eq!(decoded.stats.good_frames, frame_count);
        assert!(
            elapsed < duration,
            "{mbps} Mbps / {frame_count} frames should decode faster than {:?}, got {:?}",
            duration,
            elapsed
        );
        eprintln!("{mbps} Mbps profile: {frame_count} frames decoded in {:?}", elapsed);
    }
}
