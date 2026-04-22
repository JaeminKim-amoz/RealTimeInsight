use rti_core::bridge::{
    panel_stream_event_from_chunk, subscribe_panel_data, BridgeEvent, CrcEvent, ExportProgressEvent,
    IngestStatusEvent, LlmToolProgressEvent, PanelDataSchema, PanelStreamDataEvent,
    SubscribePanelDataInput, SyncLossEvent, VideoSyncEvent,
};
use rti_core::data_ref::DataRefRegistry;
use rti_core::pcm::{create_test_frame, decode_bitstream, frame_to_bits, PcmProfile};

#[test]
fn serializes_ingest_status_event_with_frontend_names() {
    let event = BridgeEvent::IngestStatus(IngestStatusEvent {
        source_connected: true,
        packet_rate_hz: 4100.0,
        frame_rate_hz: 200.0,
        bitrate_mbps: 22.5,
        crc_fail_rate: 0.02,
        sync_loss_count: 1,
    });

    let json = serde_json::to_value(event).unwrap();
    assert_eq!(json["type"], "ingest_status");
    assert_eq!(json["payload"]["sourceConnected"], true);
    assert_eq!(json["payload"]["bitrateMbps"], 22.5);
}

#[test]
fn serializes_panel_data_event_with_data_ref_not_inline_samples() {
    let event = BridgeEvent::PanelStreamData(PanelStreamDataEvent {
        subscription_id: "sub-1".to_string(),
        panel_id: "panel-1".to_string(),
        schema: PanelDataSchema::TimeseriesV1,
        data_ref: "buffer://rti/live/sub-1/1".to_string(),
        range_ns: ["100".to_string(), "200".to_string()],
        seq: 1,
    });

    let json = serde_json::to_value(event).unwrap();
    assert_eq!(json["type"], "panel_stream_data");
    assert_eq!(json["payload"]["schema"], "timeseries-v1");
    assert_eq!(json["payload"]["dataRef"], "buffer://rti/live/sub-1/1");
    assert!(json["payload"].get("samples").is_none());
}

#[test]
fn subscribe_panel_data_rejects_empty_channel_list() {
    let input = SubscribePanelDataInput {
        panel_id: "panel-1".to_string(),
        channel_ids: vec![],
        schema: PanelDataSchema::TimeseriesV1,
        range_ns: None,
    };

    assert!(subscribe_panel_data(input).is_err());
}

#[test]
fn subscribe_panel_data_returns_stable_handle() {
    let input = SubscribePanelDataInput {
        panel_id: "panel-1".to_string(),
        channel_ids: vec![1001, 1002],
        schema: PanelDataSchema::TimeseriesV1,
        range_ns: None,
    };

    let handle = subscribe_panel_data(input).unwrap();
    assert_eq!(handle.subscription_id, "sub:panel-1:2");
}

#[test]
fn panel_stream_event_uses_data_ref_chunk() {
    let profile = PcmProfile::default();
    let decoded = decode_bitstream(
        &frame_to_bits(&create_test_frame(9, false, &profile), 0, &profile),
        &profile,
    );
    let mut registry = DataRefRegistry::new("live");
    let chunk = registry.insert_samples("sub-1", decoded.frames[0].samples.clone());

    let event = panel_stream_event_from_chunk(
        "sub-1",
        "panel-1",
        PanelDataSchema::TimeseriesV1,
        ["0".to_string(), "1".to_string()],
        1,
        &chunk,
    );

    let json = serde_json::to_value(event).unwrap();
    assert_eq!(json["payload"]["dataRef"], chunk.data_ref);
    assert!(json["payload"].get("samples").is_none());
}

#[test]
fn serializes_diagnostic_and_tool_progress_events() {
    let crc = serde_json::to_value(BridgeEvent::CrcEvent(CrcEvent {
        frame_counter: 22,
        channel_ids: vec![8001, 1205],
        reason: "crc-fail".to_string(),
        timestamp_ns: "22000000".to_string(),
    }))
    .unwrap();
    assert_eq!(crc["type"], "crc_event");
    assert_eq!(crc["payload"]["frameCounter"], 22);

    let sync = serde_json::to_value(BridgeEvent::SyncLossEvent(SyncLossEvent {
        lost_at_ns: "22000000".to_string(),
        reacquired_at_ns: "26000000".to_string(),
        duration_ns: "4000000".to_string(),
        bit_offset: 7,
    }))
    .unwrap();
    assert_eq!(sync["payload"]["bitOffset"], 7);

    let export = serde_json::to_value(BridgeEvent::ExportProgress(ExportProgressEvent {
        job_id: 3,
        status: "completed".to_string(),
        rows_written: 512,
        artifact_path: "project/runtime/exports/a.csv".to_string(),
        manifest_path: "project/runtime/exports/a.manifest.json".to_string(),
    }))
    .unwrap();
    assert_eq!(export["payload"]["rowsWritten"], 512);

    let llm = serde_json::to_value(BridgeEvent::LlmToolProgress(LlmToolProgressEvent {
        job_id: 4,
        tool: "ollama".to_string(),
        status: "citation-gate-passed".to_string(),
        evidence_ids: vec!["EVT-1".to_string(), "CH-1002".to_string()],
    }))
    .unwrap();
    assert_eq!(llm["payload"]["evidenceIds"][0], "EVT-1");

    let video = serde_json::to_value(BridgeEvent::VideoSyncEvent(VideoSyncEvent {
        cursor_ns: "182340000000".to_string(),
        segment_id: "sortie-0410-seg-1".to_string(),
        frame_ref: "video://sortie-0410/000123".to_string(),
    }))
    .unwrap();
    assert_eq!(video["type"], "video_sync_event");
}
