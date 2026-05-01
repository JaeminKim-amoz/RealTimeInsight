use rti_core::ingest::pipeline::ingest_pcm_datagram;
use rti_core::ingest::IngestStore;
use rti_core::pcm::{bits_to_bytes, create_test_frame, frame_to_bits, PcmProfile};

#[test]
fn ingests_good_and_bad_frames_from_udp_datagram_bytes() {
    let profile = PcmProfile::default();
    let mut bits = Vec::new();
    bits.extend(frame_to_bits(&create_test_frame(21, false, &profile), 5, &profile));
    bits.extend(frame_to_bits(&create_test_frame(22, true, &profile), 0, &profile));
    let datagram = bits_to_bytes(&bits);
    let mut store = IngestStore::new(8);

    let report = ingest_pcm_datagram(&mut store, &datagram, &profile);

    assert_eq!(report.stats.sync_matches, 2);
    assert_eq!(report.stats.good_frames, 1);
    assert_eq!(report.stats.bad_frames, 1);
    assert_eq!(report.accepted_frames, 1);
    assert_eq!(report.rejected_frames, 1);
    assert_eq!(store.channel_snapshot(8001).len(), 1);
    assert_eq!(store.channel_snapshot(8001)[0].raw, 21);
}

#[test]
fn empty_datagram_produces_no_samples() {
    let profile = PcmProfile::default();
    let mut store = IngestStore::new(8);

    let report = ingest_pcm_datagram(&mut store, &[], &profile);

    assert_eq!(report.stats.sync_matches, 0);
    assert_eq!(report.accepted_frames, 0);
    assert!(store.channel_snapshot(8001).is_empty());
}
