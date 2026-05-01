use std::time::Instant;

use rti_core::pcm::{create_test_frame, decode_bitstream, frame_to_bits, PcmProfile};

#[test]
fn decodes_200_frames_with_reasonable_throughput() {
    let profile = PcmProfile::default();
    let mut bits = Vec::new();
    for counter in 0..200u32 {
        bits.extend(frame_to_bits(
            &create_test_frame(counter, counter % 53 == 0, &profile),
            (counter as usize) % profile.word_bits,
            &profile,
        ));
    }

    let started = Instant::now();
    let decoded = decode_bitstream(&bits, &profile);
    let elapsed = started.elapsed();

    assert_eq!(decoded.stats.sync_matches, 200);
    assert_eq!(decoded.stats.bad_frames, 4);
    assert_eq!(decoded.stats.good_frames, 196);
    assert!(
        elapsed.as_millis() < 750,
        "200 frame decode should stay comfortably below smoke threshold, got {:?}",
        elapsed
    );
}
