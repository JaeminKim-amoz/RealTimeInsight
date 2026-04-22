use rti_core::pcm::DecodedSample;
use rti_core::replay::{ReplayCursor, ReplayStore};

fn sample(channel_id: u32, timestamp: f64, value: f64, flags: &[&str]) -> DecodedSample {
    DecodedSample {
        channel_id,
        raw: value as u32,
        value,
        timestamp,
        quality_flags: flags.iter().map(|flag| flag.to_string()).collect(),
    }
}

#[test]
fn replay_window_preserves_live_quality_and_channel_filter() {
    let mut store = ReplayStore::new("run-0410");
    store.append_decoded_samples(vec![
        sample(1001, 10.0, 28.0, &["sync-lock", "crc-ok"]),
        sample(1002, 10.1, 40.0, &["sync-lock", "crc-ok"]),
        sample(1001, 10.2, 29.0, &["sync-lock", "crc-fail"]),
    ]);

    let cursor = ReplayCursor::new(10.0, 10.15, vec![1001]);
    let samples = store.window(&cursor);

    assert_eq!(store.run_id(), "run-0410");
    assert_eq!(samples.len(), 1);
    assert_eq!(samples[0].channel_id, 1001);
    assert_eq!(samples[0].quality_flags, vec!["sync-lock", "crc-ok"]);
}

#[test]
fn replay_cursor_rejects_inverted_time_range() {
    let err = ReplayCursor::try_new(20.0, 10.0, vec![1001]).unwrap_err();

    assert!(err.contains("start must be <= end"));
}
