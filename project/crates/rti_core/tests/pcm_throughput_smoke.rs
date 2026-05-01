use std::time::{Duration, Instant};

use rti_core::pcm::generator::PcmGenerator;
use rti_core::pcm::{create_test_frame, decode_bitstream, decode_bytes, frame_to_bits, PcmProfile};

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

/// Slice-1 F4 acceptance gate: CRC fail rate must be < 0.1% over ~10 000 frames.
///
/// `PcmGenerator` is the authoritative frame source (US-009). It produces
/// 100% CRC-valid frames by construction, so crc_fail should be 0, but the
/// gate is expressed as a threshold to remain valid if the profile ever
/// includes deliberate corruption in future iterations.
///
/// Gated behind `RUN_PERF_SMOKE=1`.
#[test]
#[ignore]
fn slice1_strict_crc_fail_rate_under_one_per_thousand() {
    if std::env::var("RUN_PERF_SMOKE").ok().as_deref() != Some("1") {
        eprintln!("slice1_strict_crc_fail_rate_under_one_per_thousand: skipped (set RUN_PERF_SMOKE=1 to run)");
        return;
    }

    const FRAME_COUNT: usize = 10_000;
    const BITRATE_MBPS: f64 = 10.0;

    let profile = PcmProfile::default();
    let mut gen = PcmGenerator::new(profile.clone(), vec![1001, 1002], BITRATE_MBPS);

    let mut crc_pass: usize = 0;
    let mut crc_fail: usize = 0;

    for _ in 0..FRAME_COUNT {
        let frame_bytes = gen.step_bytes();
        let result = decode_bytes(&frame_bytes, &profile);
        crc_pass += result.stats.good_frames;
        crc_fail += result.stats.bad_frames;
    }

    let total = crc_pass + crc_fail;
    let fail_rate = if total == 0 {
        0.0f64
    } else {
        crc_fail as f64 / total as f64
    };

    eprintln!(
        "slice1_strict_crc_fail_rate: crc_pass={} crc_fail={} total={} fail_rate={:.6}",
        crc_pass, crc_fail, total, fail_rate,
    );

    assert!(
        fail_rate < 0.001,
        "CRC fail rate {:.6} >= 0.001 (0.1%); crc_fail={} total={}",
        fail_rate, crc_fail, total,
    );
}
