use rti_core::pcm::{create_test_frame, decode_bitstream, find_sync_offsets, frame_to_bits, PcmProfile};

#[test]
fn rolling_sync_scan_finds_expected_offsets() {
    let profile = PcmProfile::default();
    let mut bits = vec![0, 1, 0, 1, 1, 0, 0];
    let first = bits.len() + profile.sync_word_start_index * profile.word_bits;
    bits.extend(frame_to_bits(&create_test_frame(100, false, &profile), 0, &profile));
    let second = bits.len() + 3 + profile.sync_word_start_index * profile.word_bits;
    bits.extend(frame_to_bits(&create_test_frame(101, false, &profile), 3, &profile));

    let offsets = find_sync_offsets(&bits, profile.sync_pattern, profile.sync_width_bits);

    assert_eq!(offsets, vec![first, second]);
}

#[test]
fn decodes_many_frames_with_bit_slip_variants() {
    let profile = PcmProfile::default();
    let mut bits = Vec::new();
    for counter in 0..64 {
        bits.extend(frame_to_bits(
            &create_test_frame(counter, counter % 17 == 0, &profile),
            (counter as usize) % profile.word_bits,
            &profile,
        ));
    }

    let decoded = decode_bitstream(&bits, &profile);

    assert_eq!(decoded.stats.sync_matches, 64);
    assert_eq!(decoded.stats.bad_frames, 4);
    assert_eq!(decoded.stats.good_frames, 60);
    assert_eq!(decoded.frames[0].frame_counter, 1);
}
