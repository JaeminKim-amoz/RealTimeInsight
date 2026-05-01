use serde::{Deserialize, Serialize};

use crate::data_ref::DataRefChunk;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IngestStatusEvent {
    pub source_connected: bool,
    pub packet_rate_hz: f64,
    pub frame_rate_hz: f64,
    pub bitrate_mbps: f64,
    pub crc_fail_rate: f64,
    pub sync_loss_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PanelStreamDataEvent {
    pub subscription_id: String,
    pub panel_id: String,
    pub schema: PanelDataSchema,
    pub data_ref: String,
    pub range_ns: [String; 2],
    pub seq: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrcEvent {
    pub frame_counter: u32,
    pub channel_ids: Vec<u32>,
    pub reason: String,
    pub timestamp_ns: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncLossEvent {
    pub lost_at_ns: String,
    pub reacquired_at_ns: String,
    pub duration_ns: String,
    pub bit_offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgressEvent {
    pub job_id: u64,
    pub status: String,
    pub rows_written: usize,
    pub artifact_path: String,
    pub manifest_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LlmToolProgressEvent {
    pub job_id: u64,
    pub tool: String,
    pub status: String,
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VideoSyncEvent {
    pub cursor_ns: String,
    pub segment_id: String,
    pub frame_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum PanelDataSchema {
    TimeseriesV1,
    WaterfallV1,
    DiscreteV1,
    XyV1,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum BridgeEvent {
    IngestStatus(IngestStatusEvent),
    PanelStreamData(PanelStreamDataEvent),
    CrcEvent(CrcEvent),
    SyncLossEvent(SyncLossEvent),
    ExportProgress(ExportProgressEvent),
    LlmToolProgress(LlmToolProgressEvent),
    VideoSyncEvent(VideoSyncEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SubscribePanelDataInput {
    pub panel_id: String,
    pub channel_ids: Vec<u32>,
    pub schema: PanelDataSchema,
    pub range_ns: Option<[String; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SubscriptionHandle {
    #[serde(rename = "subscriptionId")]
    pub subscription_id: String,
}

pub fn subscribe_panel_data(input: SubscribePanelDataInput) -> Result<SubscriptionHandle, String> {
    if input.panel_id.is_empty() {
        return Err("panelId must not be empty".to_string());
    }
    if input.channel_ids.is_empty() {
        return Err("channelIds must not be empty".to_string());
    }
    Ok(SubscriptionHandle {
        subscription_id: format!("sub:{}:{}", input.panel_id, input.channel_ids.len()),
    })
}

pub fn panel_stream_event_from_chunk(
    subscription_id: impl Into<String>,
    panel_id: impl Into<String>,
    schema: PanelDataSchema,
    range_ns: [String; 2],
    seq: u64,
    chunk: &DataRefChunk,
) -> BridgeEvent {
    BridgeEvent::PanelStreamData(PanelStreamDataEvent {
        subscription_id: subscription_id.into(),
        panel_id: panel_id.into(),
        schema,
        data_ref: chunk.data_ref.clone(),
        range_ns,
        seq,
    })
}
