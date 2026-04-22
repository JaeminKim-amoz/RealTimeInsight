use rti_core::data_ref::DataRefRegistry;
use rti_core::pcm::{create_test_frame, decode_bitstream, frame_to_bits, PcmProfile};

fn samples() -> Vec<rti_core::pcm::DecodedSample> {
    let profile = PcmProfile::default();
    let decoded = decode_bitstream(
        &frame_to_bits(&create_test_frame(7, false, &profile), 0, &profile),
        &profile,
    );
    decoded.frames[0].samples.clone()
}

#[test]
fn stores_samples_behind_buffer_ref() {
    let mut registry = DataRefRegistry::new("live");

    let chunk = registry.insert_samples("sub-1", samples());

    assert!(chunk.data_ref.starts_with("buffer://rti/live/sub-1/"));
    assert_eq!(registry.len(), 1);
    assert_eq!(registry.get(&chunk.data_ref).unwrap().len(), chunk.samples.len());
}

#[test]
fn releases_buffer_ref_after_use() {
    let mut registry = DataRefRegistry::new("live");
    let chunk = registry.insert_samples("sub-1", samples());

    assert!(registry.release(&chunk.data_ref));
    assert!(registry.get(&chunk.data_ref).is_none());
    assert!(registry.is_empty());
    assert!(!registry.release(&chunk.data_ref));
}

#[test]
fn creates_monotonic_refs_per_subscription() {
    let mut registry = DataRefRegistry::new("replay");
    let first = registry.insert_samples("sub-9", samples());
    let second = registry.insert_samples("sub-9", samples());

    assert_eq!(first.data_ref, "buffer://rti/replay/sub-9/1");
    assert_eq!(second.data_ref, "buffer://rti/replay/sub-9/2");
}
