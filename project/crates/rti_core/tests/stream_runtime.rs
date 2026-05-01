use rti_core::data_ref::DataRefRegistry;
use rti_core::ingest::IngestStore;
use rti_core::pcm::{create_test_frame, decode_bitstream, frame_to_bits, PcmProfile};
use rti_core::stream::{build_panel_event_batch, PanelSubscription};
use rti_core::bridge::{BridgeEvent, PanelDataSchema};

fn store_with_frames() -> IngestStore {
    let profile = PcmProfile::default();
    let mut store = IngestStore::new(8);
    for counter in 1..=3 {
        let decoded = decode_bitstream(
            &frame_to_bits(&create_test_frame(counter, false, &profile), 0, &profile),
            &profile,
        );
        store.ingest_frame(&decoded.frames[0]);
    }
    store
}

#[test]
fn builds_panel_stream_events_from_ingest_store() {
    let store = store_with_frames();
    let mut registry = DataRefRegistry::new("live");
    let subscriptions = vec![PanelSubscription {
        subscription_id: "sub-1".to_string(),
        panel_id: "panel-1".to_string(),
        channel_ids: vec![8001, 1205],
        schema: PanelDataSchema::TimeseriesV1,
    }];

    let batch = build_panel_event_batch(&mut registry, &store, &subscriptions, 7);

    assert_eq!(batch.events.len(), 1);
    assert_eq!(batch.data_refs.len(), 1);
    assert!(registry.get(&batch.data_refs[0]).is_some());

    match &batch.events[0] {
        BridgeEvent::PanelStreamData(payload) => {
            assert_eq!(payload.subscription_id, "sub-1");
            assert_eq!(payload.panel_id, "panel-1");
            assert_eq!(payload.seq, 7);
            assert_eq!(payload.data_ref, batch.data_refs[0]);
            assert!(payload.range_ns[0].parse::<i128>().unwrap() > 0);
            assert!(payload.range_ns[1].parse::<i128>().unwrap() >= payload.range_ns[0].parse::<i128>().unwrap());
        }
        _ => panic!("expected panel stream event"),
    }
}

#[test]
fn skips_subscriptions_without_samples() {
    let store = IngestStore::new(8);
    let mut registry = DataRefRegistry::new("live");
    let subscriptions = vec![PanelSubscription {
        subscription_id: "sub-empty".to_string(),
        panel_id: "panel-empty".to_string(),
        channel_ids: vec![42],
        schema: PanelDataSchema::TimeseriesV1,
    }];

    let batch = build_panel_event_batch(&mut registry, &store, &subscriptions, 1);

    assert!(batch.events.is_empty());
    assert!(batch.data_refs.is_empty());
    assert!(registry.is_empty());
}
