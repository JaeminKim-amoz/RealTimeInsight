use rti_core::pcm::{
    create_test_frame, decode_bitstream, frame_to_bits, PcmProfile,
};

#[test]
fn recovers_each_possible_bit_slip_offset() {
    let profile = PcmProfile::default();

    for slip in 0..profile.word_bits {
        let bits = frame_to_bits(&create_test_frame(0x2200 + slip as u32, false, &profile), slip, &profile);
        let decoded = decode_bitstream(&bits, &profile);

        assert_eq!(decoded.stats.good_frames, 1, "slip {slip} should decode one frame");
        assert_eq!(decoded.frames[0].bit_offset, slip, "slip {slip} should recover exact bit offset");
        assert!(decoded.frames[0].quality_flags.iter().any(|flag| flag == "sync-lock"));
        assert!(decoded.frames[0].quality_flags.iter().any(|flag| flag == "crc-ok"));
    }
}

#[test]
fn recovers_non_byte_aligned_frames_and_rejects_bad_crc() {
    let profile = PcmProfile::default();
    let mut bits = Vec::new();
    bits.extend(frame_to_bits(&create_test_frame(0x12340, false, &profile), 5, &profile));
    bits.extend(frame_to_bits(&create_test_frame(0x12341, false, &profile), 0, &profile));
    bits.extend(frame_to_bits(&create_test_frame(0x12342, true, &profile), 0, &profile));

    let decoded = decode_bitstream(&bits, &profile);

    assert_eq!(decoded.stats.sync_matches, 3);
    assert_eq!(decoded.stats.good_frames, 2);
    assert_eq!(decoded.stats.bad_frames, 1);
    assert_eq!(decoded.frames[0].bit_offset, 5);
    assert_eq!(decoded.frames[0].frame_counter, 0x12340);
    assert_eq!(decoded.frames[1].subcommutation, 0x1);
    assert!(!decoded.bad_frames[0].crc_ok);
    assert!(decoded.bad_frames[0].samples.is_empty());
    assert!(decoded.bad_frames[0].quality_flags.iter().any(|flag| flag == "crc-fail"));
}

#[test]
fn extracts_counter_and_subcommutation_from_frame_words() {
    let profile = PcmProfile::default();
    let bits = frame_to_bits(&create_test_frame(0x00FF_00AF, false, &profile), 0, &profile);

    let decoded = decode_bitstream(&bits, &profile);

    assert_eq!(decoded.frames.len(), 1);
    assert_eq!(decoded.frames[0].frame_counter, 0x00FF_00AF);
    assert_eq!(decoded.frames[0].subcommutation, 0xF);
    assert!(decoded.frames[0].crc_ok);
}

#[test]
fn extracts_display_samples_for_core_channels() {
    let profile = PcmProfile::default();
    let bits = frame_to_bits(&create_test_frame(0x00AA_0003, false, &profile), 0, &profile);

    let decoded = decode_bitstream(&bits, &profile);
    let samples = &decoded.frames[0].samples;

    assert!(samples.iter().any(|sample| sample.channel_id == 8001 && sample.raw == 0x00AA_0003));
    assert!(samples.iter().any(|sample| sample.channel_id == 8004 && sample.value == 3.0));
    assert!(samples.iter().any(|sample| sample.channel_id == 8006 && sample.value == 1.0));
    assert!(samples.iter().any(|sample| sample.channel_id == 1001));
    assert!(samples.iter().any(|sample| sample.channel_id == 1205));
    assert!(samples.iter().all(|sample| sample.quality_flags.iter().any(|flag| flag == "crc-ok")));
}
