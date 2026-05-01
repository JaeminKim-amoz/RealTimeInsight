use rti_core::pcm::{
    bits_from_bytes, decode_bitstream, generator::PcmGenerator, PcmProfile, SyncPlacement,
};

/// Compact 64-word × 10-bit profile from the PRD: 640 bits → 80 bytes/frame.
/// Used to verify generator math (bytes_per_frame, frame_rate_hz). The
/// existing decoder is tuned for word_bits=16, so this profile is *not*
/// used for round-trip decode tests.
fn compact_profile_64x10() -> PcmProfile {
    PcmProfile {
        sync_pattern: 0x00FA_F320,
        sync_width_bits: 24,
        sync_placement: SyncPlacement::Trailing,
        frame_words: 64,
        word_bits: 10,
        crc_word_index: 61,
        sync_word_start_index: 62,
        subcommutation_mask_bits: 4,
        crc_initial: 0xFFFF,
        crc_xor_out: 0x0000,
    }
}

/// Decoder-compatible profile: matches the existing 640-word × 16-bit
/// decoder geometry that `decode_bitstream` + `extract_samples` expect
/// (the latter hardcodes word indices up to 65). Used only for the
/// round-trip test; the calibration/length tests use the compact profile
/// to honor the PRD's 64×10 acceptance criterion.
fn decoder_compatible_profile() -> PcmProfile {
    PcmProfile::default()
}

#[test]
fn bytes_per_frame_matches_profile_geometry() {
    let profile = compact_profile_64x10();
    let gen = PcmGenerator::new(profile.clone(), vec![1001], 10.0);

    // 64 words * 10 bits = 640 bits → 80 bytes.
    let expected_bits = profile.frame_words * profile.word_bits;
    let expected_bytes = expected_bits.div_ceil(8);
    assert_eq!(gen.bytes_per_frame, expected_bytes);
    assert_eq!(expected_bytes, 80);
}

#[test]
fn target_frame_rate_matches_calibration_at_10_mbps() {
    let profile = compact_profile_64x10();
    let gen = PcmGenerator::new(profile.clone(), vec![1001], 10.0);

    // PRD spec: frame_rate ≈ 10e6 / (bytes_per_frame * 8) when frame is fully
    // packed, which for this profile is identical to bits_per_frame-based math.
    let bits_per_frame = (profile.frame_words * profile.word_bits) as f64;
    let expected = 10.0e6 / bits_per_frame;
    let actual = gen.target_frame_rate_hz();
    assert!(
        (actual - expected).abs() < 1.0,
        "expected {expected} Hz, got {actual} Hz"
    );

    // Also confirm the bytes-based formulation from the PRD agrees within 1%.
    let alt_expected = 10.0e6 / (gen.bytes_per_frame as f64 * 8.0);
    assert!(
        (actual - alt_expected).abs() / alt_expected < 0.01,
        "bytes-based calibration drifted: actual={actual} expected={alt_expected}"
    );
}

#[test]
fn step_returns_words_matching_profile_length() {
    let profile = compact_profile_64x10();
    let mut gen = PcmGenerator::new(profile.clone(), vec![1001], 10.0);

    let frame = gen.step();
    assert_eq!(frame.len(), profile.frame_words);
}

#[test]
fn step_bytes_round_trips_through_decode_with_valid_crc() {
    // Decoder compatibility requires the 640-word × 16-bit profile shape
    // because `extract_samples` indexes hardcoded word slots (e.g. words[64]).
    // The compact 64×10 profile is exercised by the calibration tests above.
    let profile = decoder_compatible_profile();
    let mut gen = PcmGenerator::new(profile.clone(), vec![1001], 10.0);

    let bytes = gen.step_bytes();
    let bits = bits_from_bytes(&bytes);
    let decoded = decode_bitstream(&bits, &profile);

    assert_eq!(decoded.stats.good_frames, 1, "exactly one good frame");
    assert_eq!(decoded.stats.bad_frames, 0, "no bad frames (crc_fail == 0)");
    assert!(decoded.frames[0].crc_ok, "crc_pass == 1");
}

#[test]
fn thousand_consecutive_steps_produce_unique_increasing_counters() {
    let profile = compact_profile_64x10();
    let mut gen = PcmGenerator::new(profile, vec![1001], 10.0);

    let mut counters: Vec<u32> = Vec::with_capacity(1000);
    for _ in 0..1000 {
        let words = gen.step();
        let counter = ((words[0] as u32) << 16) | (words[1] as u32);
        counters.push(counter);
    }

    // Unique
    let mut sorted = counters.clone();
    sorted.sort();
    sorted.dedup();
    assert_eq!(sorted.len(), 1000, "all 1000 counters must be unique");

    // Strictly increasing by 1
    for window in counters.windows(2) {
        assert_eq!(window[1], window[0].wrapping_add(1));
    }
}
