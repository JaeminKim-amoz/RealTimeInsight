use rti_core::ingest::IngestStore;
use rti_core::pcm::{create_test_frame, decode_bitstream, frame_to_bits, PcmProfile};

#[test]
fn rejects_bad_crc_frames_from_display_samples() {
    let profile = PcmProfile::default();
    let mut bits = Vec::new();
    bits.extend(frame_to_bits(&create_test_frame(1, false, &profile), 0, &profile));
    bits.extend(frame_to_bits(&create_test_frame(2, true, &profile), 0, &profile));

    let decoded = decode_bitstream(&bits, &profile);
    let mut store = IngestStore::new(16);
    for frame in decoded.frames.iter().chain(decoded.bad_frames.iter()) {
        store.ingest_frame(frame);
    }

    assert_eq!(store.stats().accepted_frames, 1);
    assert_eq!(store.stats().rejected_frames, 1);
    assert_eq!(store.channel_snapshot(8001).len(), 1);
    assert_eq!(store.channel_snapshot(8001)[0].raw, 1);
}

#[test]
fn keeps_only_recent_samples_per_channel() {
    let profile = PcmProfile::default();
    let mut store = IngestStore::new(2);

    for counter in 10..13 {
        let decoded = decode_bitstream(
            &frame_to_bits(&create_test_frame(counter, false, &profile), 0, &profile),
            &profile,
        );
        store.ingest_frame(&decoded.frames[0]);
    }

    let frame_counter_samples = store.channel_snapshot(8001);
    assert_eq!(frame_counter_samples.len(), 2);
    assert_eq!(frame_counter_samples[0].raw, 11);
    assert_eq!(frame_counter_samples[1].raw, 12);
}

#[test]
fn snapshots_all_samples_with_optional_channel_filter() {
    let profile = PcmProfile::default();
    let decoded = decode_bitstream(
        &frame_to_bits(&create_test_frame(15, false, &profile), 0, &profile),
        &profile,
    );
    let mut store = IngestStore::new(8);
    store.ingest_frame(&decoded.frames[0]);

    let all = store.samples_snapshot(None);
    let filtered = store.samples_snapshot(Some(&[1205]));

    assert!(all.len() > filtered.len());
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].channel_id, 1205);
}
