use crate::bridge::{panel_stream_event_from_chunk, BridgeEvent, PanelDataSchema};
use crate::data_ref::DataRefRegistry;
use crate::ingest::IngestStore;

#[derive(Debug, Clone)]
pub struct PanelSubscription {
    pub subscription_id: String,
    pub panel_id: String,
    pub channel_ids: Vec<u32>,
    pub schema: PanelDataSchema,
}

#[derive(Debug, Clone)]
pub struct PanelEventBatch {
    pub events: Vec<BridgeEvent>,
    pub data_refs: Vec<String>,
}

pub fn build_panel_event_batch(
    registry: &mut DataRefRegistry,
    store: &IngestStore,
    subscriptions: &[PanelSubscription],
    seq: u64,
) -> PanelEventBatch {
    let mut events = Vec::new();
    let mut data_refs = Vec::new();

    for subscription in subscriptions {
        let mut samples = Vec::new();
        for channel_id in &subscription.channel_ids {
            samples.extend_from_slice(store.channel_snapshot(*channel_id));
        }
        if samples.is_empty() {
            continue;
        }

        let min_ts = samples
            .iter()
            .map(|sample| sample.timestamp)
            .fold(f64::INFINITY, f64::min);
        let max_ts = samples
            .iter()
            .map(|sample| sample.timestamp)
            .fold(f64::NEG_INFINITY, f64::max);

        let chunk = registry.insert_samples(&subscription.subscription_id, samples);
        let range_ns = [
            seconds_to_ns_string(min_ts),
            seconds_to_ns_string(max_ts),
        ];
        data_refs.push(chunk.data_ref.clone());
        events.push(panel_stream_event_from_chunk(
            subscription.subscription_id.clone(),
            subscription.panel_id.clone(),
            subscription.schema.clone(),
            range_ns,
            seq,
            &chunk,
        ));
    }

    PanelEventBatch { events, data_refs }
}

fn seconds_to_ns_string(seconds: f64) -> String {
    ((seconds * 1_000_000_000.0).round() as i128).to_string()
}
