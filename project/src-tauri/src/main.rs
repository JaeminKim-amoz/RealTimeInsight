mod path_policy;

use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::Mutex;

use rti_core::bridge::{
    subscribe_panel_data as core_subscribe_panel_data, IngestStatusEvent, PanelDataSchema,
    SubscribePanelDataInput, SubscriptionHandle, BridgeEvent, VideoSyncEvent,
};
use rti_core::assets::{discover_assets, AssetKind};
use rti_core::data_ref::DataRefRegistry;
use rti_core::ingest::managed::{ManagedReceiverConfig, ManagedReceiverRuntime};
use rti_core::export::{build_export_manifest, export_samples_csv, write_csv_export_job, CsvExportOptions, QualityPolicy, ValueMode};
use rti_core::graph::{EvidenceEdge, EvidenceEdgeKind, EvidenceGraph, EvidenceNode, EvidenceNodeKind, RootCauseCandidate};
use rti_core::ingest::receiver::diagnostic_events_for_report;
use rti_core::ingest::receiver::ReceiverSession;
use rti_core::ingest::pipeline::ingest_pcm_datagram;
use rti_core::ingest::IngestStore;
use rti_core::jobs::{Job, JobKind, JobQueue};
use rti_core::llm::{build_evidence_prompt, build_ollama_chat_request, evaluate_evidence_answer, ollama_chat_request_json, EvidenceItem};
use rti_core::matlab::{build_anomaly_bundle_script, build_matlab_mcp_run_request, validate_generated_script, validate_script_path, MatlabEvidence};
use rti_core::pcm::{bits_to_bytes, create_test_frame, decode_bitstream, frame_to_bits, PcmProfile};
use rti_core::simdis::{missing_sidecar_diagnostic, profile_to_json, sidecar_status_from_profile, DisValidationProfile, SimdisBridgeProfile, SimdisSidecarHealth};
use rti_core::stream::{build_panel_event_batch, PanelSubscription};
use rti_core::video::{seek_video_frame, VideoSegment, VideoSegmentIndex};
use tauri::Emitter;

#[derive(Default)]
struct AppState {
    live_running: Mutex<bool>,
    demo_seq: Mutex<u64>,
    receiver_session: Mutex<Option<ReceiverSession>>,
    managed_receiver: Mutex<Option<ManagedReceiverRuntime>>,
    managed_receiver_bind_addr: Mutex<Option<String>>,
    jobs: Mutex<JobQueue>,
}

fn runtime_exports_dir() -> Result<std::path::PathBuf, String> {
    path_policy::runtime_exports_dir_from_cwd(std::env::current_dir().map_err(|err| err.to_string())?)
}

fn runtime_assets_dir() -> Result<std::path::PathBuf, String> {
    path_policy::runtime_assets_dir_from_cwd(std::env::current_dir().map_err(|err| err.to_string())?)
}

fn runtime_matlab_dir() -> Result<std::path::PathBuf, String> {
    path_policy::runtime_matlab_dir_from_cwd(std::env::current_dir().map_err(|err| err.to_string())?)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveSessionStatus {
    running: bool,
    demo_seq: u64,
    receiver_ready: bool,
    accepted_frames: u64,
    rejected_frames: u64,
    accepted_samples: u64,
    timeout_count: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedReceiverStatus {
    running: bool,
    bind_addr: Option<String>,
    accepted_frames: u64,
    rejected_frames: u64,
    accepted_samples: u64,
    timeout_count: u64,
    queued_events: usize,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedReceiverStartInput {
    bind_ip: Option<String>,
    bind_port: Option<u16>,
    channel_ids: Option<Vec<u32>>,
    expected_bitrate_mbps: Option<u32>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DemoReceiverTickInput {
    channel_ids: Option<Vec<u32>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportPreview {
    format: String,
    rows: usize,
    content: String,
    manifest: ExportPreviewManifest,
    csv_path: Option<String>,
    manifest_path: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportPreviewManifest {
    channel_ids: Vec<u32>,
    row_count: usize,
    quality_policy: String,
    value_mode: String,
    range: Option<[f64; 2]>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportDemoCsvInput {
    channel_ids: Option<Vec<u32>>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValidateLlmEvidenceInput {
    answer: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LlmEvidenceValidation {
    prompt: String,
    required_citations: Vec<String>,
    cited: Vec<String>,
    missing: Vec<String>,
    valid: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaRequestPreview {
    enabled: bool,
    model: String,
    request_json: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeAssetInventory {
    assets: Vec<RuntimeAsset>,
    runtimes: Vec<RuntimeHealthView>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeAsset {
    name: String,
    kind: String,
    available: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHealthView {
    name: String,
    health: String,
    detail: Option<String>,
    action: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SimdisBridgeStatusView {
    name: String,
    target: String,
    publish_rate_hz: u32,
    health: String,
    detail: String,
    profile_json: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MatlabHandoffView {
    script_path: String,
    tool_name: String,
    request_json: String,
    evidence_ids: Vec<String>,
}

fn live_status_from_state(state: &tauri::State<'_, AppState>, running: bool) -> Result<LiveSessionStatus, String> {
    let demo_seq = *state.demo_seq.lock().map_err(|_| "live sequence lock poisoned".to_string())?;
    let receiver = state
        .receiver_session
        .lock()
        .map_err(|_| "receiver session lock poisoned".to_string())?;
    let accepted_frames = receiver
        .as_ref()
        .map(|session| session.store.stats().accepted_frames)
        .unwrap_or(0);
    let rejected_frames = receiver
        .as_ref()
        .map(|session| session.store.stats().rejected_frames)
        .unwrap_or(0);
    let accepted_samples = receiver
        .as_ref()
        .map(|session| session.store.stats().accepted_samples)
        .unwrap_or(0);
    let timeout_count = receiver
        .as_ref()
        .map(|session| session.timeout_count)
        .unwrap_or(0);
    Ok(LiveSessionStatus {
        running,
        demo_seq,
        receiver_ready: receiver.is_some(),
        accepted_frames,
        rejected_frames,
        accepted_samples,
        timeout_count,
    })
}

fn managed_receiver_status_from_state(
    state: &tauri::State<'_, AppState>,
) -> Result<ManagedReceiverStatus, String> {
    let receiver = state
        .managed_receiver
        .lock()
        .map_err(|_| "managed receiver lock poisoned".to_string())?;
    let bind_addr = state
        .managed_receiver_bind_addr
        .lock()
        .map_err(|_| "managed receiver bind addr lock poisoned".to_string())?
        .clone();
    let snapshot = receiver
        .as_ref()
        .map(|runtime| runtime.snapshot())
        .unwrap_or_default();
    Ok(ManagedReceiverStatus {
        running: snapshot.running,
        bind_addr,
        accepted_frames: snapshot.accepted_frames,
        rejected_frames: snapshot.rejected_frames,
        accepted_samples: snapshot.accepted_samples,
        timeout_count: snapshot.timeout_count,
        queued_events: snapshot.queued_events,
    })
}

fn emit_bridge_event(app: &tauri::AppHandle, event: &BridgeEvent) -> Result<(), String> {
    app.emit("rti://bridge-event", event)
        .map_err(|err| format!("failed to emit bridge event: {err}"))
}

#[tauri::command]
fn subscribe_panel_data(input: SubscribePanelDataInput) -> Result<SubscriptionHandle, String> {
    core_subscribe_panel_data(input)
}

#[tauri::command]
fn start_live_session(state: tauri::State<'_, AppState>) -> Result<LiveSessionStatus, String> {
    let mut running = state.live_running.lock().map_err(|_| "live state lock poisoned".to_string())?;
    *running = true;
    drop(running);
    live_status_from_state(&state, true)
}

#[tauri::command]
fn stop_live_session(state: tauri::State<'_, AppState>) -> Result<LiveSessionStatus, String> {
    let mut running = state.live_running.lock().map_err(|_| "live state lock poisoned".to_string())?;
    *running = false;
    drop(running);
    live_status_from_state(&state, false)
}

#[tauri::command]
fn live_session_status(state: tauri::State<'_, AppState>) -> Result<LiveSessionStatus, String> {
    let running = state.live_running.lock().map_err(|_| "live state lock poisoned".to_string())?;
    let is_running = *running;
    drop(running);
    live_status_from_state(&state, is_running)
}

#[tauri::command]
fn init_demo_receiver_session(state: tauri::State<'_, AppState>) -> Result<LiveSessionStatus, String> {
    let session = ReceiverSession::new(
        PcmProfile::default(),
        256,
        "live",
        vec![PanelSubscription {
            subscription_id: "sub-demo".to_string(),
            panel_id: "panel-demo".to_string(),
            channel_ids: vec![8001, 1205],
            schema: PanelDataSchema::TimeseriesV1,
        }],
    );
    let mut receiver = state
        .receiver_session
        .lock()
        .map_err(|_| "receiver session lock poisoned".to_string())?;
    *receiver = Some(session);
    drop(receiver);
    let running = *state.live_running.lock().map_err(|_| "live state lock poisoned".to_string())?;
    live_status_from_state(&state, running)
}

#[tauri::command]
fn current_ingest_status(state: tauri::State<'_, AppState>) -> IngestStatusEvent {
    let managed = managed_receiver_status_from_state(&state).ok();
    let source_connected = managed.as_ref().map(|status| status.running).unwrap_or(false);
    let accepted_frames = managed
        .as_ref()
        .map(|status| status.accepted_frames)
        .unwrap_or(0);
    let rejected_frames = managed
        .as_ref()
        .map(|status| status.rejected_frames)
        .unwrap_or(0);
    let total_frames = accepted_frames + rejected_frames;
    IngestStatusEvent {
        source_connected,
        packet_rate_hz: accepted_frames as f64,
        frame_rate_hz: accepted_frames as f64,
        bitrate_mbps: 0.0,
        crc_fail_rate: if total_frames == 0 {
            0.0
        } else {
            rejected_frames as f64 / total_frames as f64
        },
        sync_loss_count: 0,
    }
}

#[tauri::command]
fn supported_panel_schemas() -> Vec<PanelDataSchema> {
    vec![
        PanelDataSchema::TimeseriesV1,
        PanelDataSchema::WaterfallV1,
        PanelDataSchema::DiscreteV1,
        PanelDataSchema::XyV1,
    ]
}

#[tauri::command]
fn start_managed_receiver_loop(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    input: Option<ManagedReceiverStartInput>,
) -> Result<ManagedReceiverStatus, String> {
    {
        let receiver = state
            .managed_receiver
            .lock()
            .map_err(|_| "managed receiver lock poisoned".to_string())?;
        if receiver.as_ref().map(|runtime| runtime.snapshot().running).unwrap_or(false) {
            drop(receiver);
            return managed_receiver_status_from_state(&state);
        }
    }

    let input = input.unwrap_or(ManagedReceiverStartInput {
        bind_ip: None,
        bind_port: None,
        channel_ids: None,
        expected_bitrate_mbps: None,
    });
    let bind_ip = input
        .bind_ip
        .unwrap_or_else(|| "127.0.0.1".to_string())
        .parse::<Ipv4Addr>()
        .map_err(|err| format!("invalid managed receiver bindIp: {err}"))?;
    let bind_port = input.bind_port.unwrap_or(0);
    // Slice-1 PRD US-011 / Critic C8: include channel #1001 (Power Bus Voltage)
    // in the default subscription so the StripPanel TS-bootstrap path lights up
    // immediately under `npm run tauri:dev` even before the user invokes
    // subscribe_panel_data explicitly. See main.rs:250-251 for the
    // subscribe_panel_data delegation; line 399 is where rti://bridge-event is
    // emitted to the frontend.
    let channel_ids = input
        .channel_ids
        .filter(|ids| !ids.is_empty())
        .unwrap_or_else(|| vec![1001, 8001, 1205]);
    let expected_bitrate = input.expected_bitrate_mbps.unwrap_or(30);
    if !(1..=30).contains(&expected_bitrate) {
        return Err("expectedBitrateMbps must be within 1..=30".to_string());
    }

    let socket = UdpSocket::bind(SocketAddr::new(IpAddr::V4(bind_ip), bind_port))
        .map_err(|err| format!("failed to bind managed receiver UDP socket: {err}"))?;
    let bind_addr = socket
        .local_addr()
        .map_err(|err| format!("failed to read managed receiver bind addr: {err}"))?
        .to_string();
    let event_app = app.clone();
    let runtime = ManagedReceiverRuntime::start_with_sink(
        socket,
        ManagedReceiverConfig {
            profile: PcmProfile::default(),
            capacity_per_channel: 256,
            data_namespace: "live".to_string(),
            subscriptions: vec![PanelSubscription {
                subscription_id: "sub-live".to_string(),
                panel_id: "panel-live".to_string(),
                channel_ids,
                schema: PanelDataSchema::TimeseriesV1,
            }],
            max_datagram_len: 4096,
            timeout: std::time::Duration::from_millis(50),
        },
        move |event| {
            let _ = event_app.emit("rti://bridge-event", event);
        },
    )?;
    {
        let mut receiver = state
            .managed_receiver
            .lock()
            .map_err(|_| "managed receiver lock poisoned".to_string())?;
        *receiver = Some(runtime);
    }
    {
        let mut saved_bind_addr = state
            .managed_receiver_bind_addr
            .lock()
            .map_err(|_| "managed receiver bind addr lock poisoned".to_string())?;
        *saved_bind_addr = Some(bind_addr);
    }
    managed_receiver_status_from_state(&state)
}

#[tauri::command]
fn stop_managed_receiver_loop(state: tauri::State<'_, AppState>) -> Result<ManagedReceiverStatus, String> {
    {
        let mut receiver = state
            .managed_receiver
            .lock()
            .map_err(|_| "managed receiver lock poisoned".to_string())?;
        if let Some(runtime) = receiver.as_mut() {
            runtime.stop()?;
        }
        *receiver = None;
    }
    {
        let mut saved_bind_addr = state
            .managed_receiver_bind_addr
            .lock()
            .map_err(|_| "managed receiver bind addr lock poisoned".to_string())?;
        *saved_bind_addr = None;
    }
    managed_receiver_status_from_state(&state)
}

#[tauri::command]
fn managed_receiver_status(state: tauri::State<'_, AppState>) -> Result<ManagedReceiverStatus, String> {
    managed_receiver_status_from_state(&state)
}

#[tauri::command]
fn drain_managed_receiver_events(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BridgeEvent>, String> {
    let receiver = state
        .managed_receiver
        .lock()
        .map_err(|_| "managed receiver lock poisoned".to_string())?;
    let events = receiver
        .as_ref()
        .map(ManagedReceiverRuntime::drain_events)
        .unwrap_or_default();
    for event in &events {
        emit_bridge_event(&app, event)?;
    }
    Ok(events)
}

#[tauri::command]
fn demo_panel_stream_event(state: tauri::State<'_, AppState>) -> Result<Option<BridgeEvent>, String> {
    let mut seq = state.demo_seq.lock().map_err(|_| "live sequence lock poisoned".to_string())?;
    *seq += 1;
    let profile = PcmProfile::default();
    let decoded = decode_bitstream(
        &frame_to_bits(&create_test_frame(*seq as u32, false, &profile), 0, &profile),
        &profile,
    );
    let mut store = IngestStore::new(8);
    store.ingest_frame(&decoded.frames[0]);
    let mut registry = DataRefRegistry::new("demo");
    let batch = build_panel_event_batch(
        &mut registry,
        &store,
        &[PanelSubscription {
            subscription_id: "sub-demo".to_string(),
            panel_id: "panel-demo".to_string(),
            channel_ids: vec![8001, 1205],
            schema: PanelDataSchema::TimeseriesV1,
        }],
        *seq,
    );
    Ok(batch.events.into_iter().next())
}

#[tauri::command]
fn demo_receiver_tick(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    input: Option<DemoReceiverTickInput>,
) -> Result<Option<BridgeEvent>, String> {
    let mut seq = state.demo_seq.lock().map_err(|_| "live sequence lock poisoned".to_string())?;
    *seq += 1;
    let frame_counter = *seq as u32;
    let datagram = bits_to_bytes(&frame_to_bits(
        &create_test_frame(frame_counter, false, &PcmProfile::default()),
        (frame_counter as usize) % PcmProfile::default().word_bits,
        &PcmProfile::default(),
    ));
    let mut receiver = state
        .receiver_session
        .lock()
        .map_err(|_| "receiver session lock poisoned".to_string())?;
    let channel_ids = input
        .and_then(|value| value.channel_ids)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| vec![8001, 1205]);
    if receiver.is_none() {
        *receiver = Some(ReceiverSession::new(
            PcmProfile::default(),
            256,
            "live",
            vec![PanelSubscription {
                subscription_id: "sub-demo".to_string(),
                panel_id: "panel-demo".to_string(),
                channel_ids: channel_ids.clone(),
                schema: PanelDataSchema::TimeseriesV1,
            }],
        ));
    }
    let session = receiver.as_mut().expect("receiver session initialized");
    session.subscriptions = vec![PanelSubscription {
        subscription_id: "sub-demo".to_string(),
        panel_id: "panel-demo".to_string(),
        channel_ids,
        schema: PanelDataSchema::TimeseriesV1,
    }];
    let report = ingest_pcm_datagram(&mut session.store, &datagram, &session.profile);
    let batch = build_panel_event_batch(
        &mut session.registry,
        &session.store,
        &session.subscriptions,
        *seq,
    );
    for event in diagnostic_events_for_report(&report) {
        emit_bridge_event(&app, &event)?;
    }
    let event = batch.events.into_iter().next();
    if let Some(event) = &event {
        emit_bridge_event(&app, event)?;
    }
    Ok(event)
}

#[tauri::command]
fn export_demo_csv(
    state: tauri::State<'_, AppState>,
    input: Option<ExportDemoCsvInput>,
) -> Result<ExportPreview, String> {
    build_export_preview(&state, input)
}

#[tauri::command]
fn write_demo_csv_export(
    state: tauri::State<'_, AppState>,
    input: Option<ExportDemoCsvInput>,
) -> Result<ExportPreview, String> {
    let mut preview = build_export_preview(&state, input)?;
    let samples = export_samples_from_state(&state, None);
    let options = CsvExportOptions {
        quality_policy: QualityPolicy::GoodCrcOnly,
        value_mode: ValueMode::Both,
        include_metadata: true,
    };
    let result = write_csv_export_job(
        &samples,
        &options,
        runtime_exports_dir()?,
        "demo-evidence",
    )?;
    {
        let mut jobs = state.jobs.lock().map_err(|_| "job queue lock poisoned".to_string())?;
        let job = jobs.push(JobKind::Export, "CSV export demo-evidence");
        jobs.mark_completed(job.id);
    }
    preview.csv_path = Some(result.csv_path.display().to_string());
    preview.manifest_path = Some(result.manifest_path.display().to_string());
    Ok(preview)
}

fn build_export_preview(
    state: &tauri::State<'_, AppState>,
    input: Option<ExportDemoCsvInput>,
) -> Result<ExportPreview, String> {
    let channel_ids = input.and_then(|value| value.channel_ids).filter(|ids| !ids.is_empty());
    let samples = export_samples_from_state(state, channel_ids.clone());
    let options = CsvExportOptions {
        quality_policy: QualityPolicy::GoodCrcOnly,
        value_mode: ValueMode::Both,
        include_metadata: true,
    };
    let content = export_samples_csv(&samples, &options);
    let manifest = build_export_manifest(&samples, &options, "csv");
    Ok(ExportPreview {
        format: "csv".to_string(),
        rows: samples.len(),
        content,
        manifest: ExportPreviewManifest {
            channel_ids: manifest.channel_ids,
            row_count: manifest.row_count,
            quality_policy: format!("{:?}", manifest.quality_policy),
            value_mode: format!("{:?}", manifest.value_mode),
            range: manifest.range.map(|(start, end)| [start, end]),
        },
        csv_path: None,
        manifest_path: None,
    })
}

fn export_samples_from_state(
    state: &tauri::State<'_, AppState>,
    channel_ids: Option<Vec<u32>>,
) -> Vec<rti_core::pcm::DecodedSample> {
    let receiver = state
        .receiver_session
        .lock()
        .ok();
    let mut samples = receiver
        .as_ref()
        .and_then(|guard| guard.as_ref())
        .map(|session| session.store.samples_snapshot(channel_ids.as_deref()))
        .filter(|samples| !samples.is_empty())
        .unwrap_or_else(|| {
            let profile = PcmProfile::default();
            let decoded = decode_bitstream(
                &frame_to_bits(&create_test_frame(42, false, &profile), 0, &profile),
                &profile,
            );
            decoded.frames[0].samples.clone()
        });
    if let Some(channel_ids) = channel_ids {
        samples.retain(|sample| channel_ids.contains(&sample.channel_id));
    }
    samples
}

#[tauri::command]
fn validate_demo_llm_answer(input: ValidateLlmEvidenceInput) -> LlmEvidenceValidation {
    let evidence = vec![
        EvidenceItem {
            id: "EVT-1".to_string(),
            label: "Hydraulic spike".to_string(),
            value: "+28 bar".to_string(),
        },
        EvidenceItem {
            id: "CH-1002".to_string(),
            label: "Bus current".to_string(),
            value: "120 ms lead".to_string(),
        },
    ];
    let prompt = build_evidence_prompt("Why did hydraulic pressure spike?", &evidence);
    let answer = evaluate_evidence_answer(input.answer, &prompt.required_citations);
    LlmEvidenceValidation {
        prompt: prompt.prompt,
        required_citations: prompt.required_citations,
        cited: answer.cited,
        missing: answer.missing,
        valid: answer.accepted,
    }
}

#[tauri::command]
fn build_demo_ollama_request() -> OllamaRequestPreview {
    let evidence = vec![
        EvidenceItem {
            id: "EVT-1".to_string(),
            label: "Hydraulic spike".to_string(),
            value: "+28 bar".to_string(),
        },
        EvidenceItem {
            id: "CH-1002".to_string(),
            label: "Bus current".to_string(),
            value: "120 ms lead".to_string(),
        },
    ];
    let prompt = build_evidence_prompt("Why did hydraulic pressure spike?", &evidence);
    let request = build_ollama_chat_request(&prompt, "gemma4:31b");
    OllamaRequestPreview {
        enabled: false,
        model: request.model.clone(),
        request_json: ollama_chat_request_json(&request),
    }
}

fn demo_matlab_evidence() -> Vec<MatlabEvidence> {
    vec![
        MatlabEvidence::new("EVT-1", "Hydraulic spike", "+28 bar"),
        MatlabEvidence::new("CH-1002", "Bus current", "120 ms lead"),
    ]
}

#[tauri::command]
fn prepare_demo_matlab_handoff() -> Result<MatlabHandoffView, String> {
    let matlab_dir = runtime_matlab_dir()?;
    std::fs::create_dir_all(&matlab_dir).map_err(|err| err.to_string())?;
    let script_path = matlab_dir.join("anomaly_bundle.m");
    validate_script_path(&matlab_dir, &script_path)?;
    let evidence = demo_matlab_evidence();
    let script = build_anomaly_bundle_script("run-0410", &evidence);
    validate_generated_script(&script)?;
    std::fs::write(&script_path, script).map_err(|err| err.to_string())?;
    let request = build_matlab_mcp_run_request(&matlab_dir, &script_path)?;
    Ok(MatlabHandoffView {
        script_path: script_path.display().to_string(),
        tool_name: request.tool_name,
        request_json: request.arguments_json,
        evidence_ids: evidence.into_iter().map(|item| item.id).collect(),
    })
}

#[tauri::command]
fn enqueue_demo_matlab_job(state: tauri::State<'_, AppState>) -> Result<Job, String> {
    let mut jobs = state.jobs.lock().map_err(|_| "job queue lock poisoned".to_string())?;
    Ok(jobs.push(JobKind::Matlab, "MATLAB anomaly bundle"))
}

#[tauri::command]
fn runtime_asset_inventory() -> RuntimeAssetInventory {
    let assets = runtime_assets_dir()
        .ok()
        .and_then(|asset_root| {
            if !asset_root.exists() {
                return None;
            }
            Some(runtime_assets_from_root(&asset_root).unwrap_or_default())
        })
        .unwrap_or_else(fallback_runtime_assets);
    RuntimeAssetInventory {
        assets,
        runtimes: vec![
            RuntimeHealthView {
                name: "matlab-mcp-core-server".to_string(),
                health: "ready".to_string(),
                detail: None,
                action: None,
            },
            RuntimeHealthView {
                name: "ollama-gemma4-31b".to_string(),
                health: "ready".to_string(),
                detail: None,
                action: None,
            },
            RuntimeHealthView {
                name: "simdis-sidecar".to_string(),
                health: "degraded".to_string(),
                detail: Some("full executable/profile not configured; SDK baseline present".to_string()),
                action: Some("Set SIMDIS_PATH/SIMDIS_PROFILE; see project/runtime/setup-simdis.md".to_string()),
            },
            RuntimeHealthView {
                name: "gstreamer".to_string(),
                health: "missing".to_string(),
                detail: Some("video runtime not configured".to_string()),
                action: Some("Install GStreamer; see project/runtime/setup-gstreamer.md".to_string()),
            },
        ],
    }
}

fn runtime_assets_from_root(asset_root: &std::path::Path) -> Result<Vec<RuntimeAsset>, String> {
    let inventory = discover_assets(asset_root)?;
    Ok(inventory
        .assets()
        .iter()
        .map(|asset| RuntimeAsset {
            name: asset.name.clone(),
            kind: asset_kind_label(asset.kind).to_string(),
            available: asset.available,
        })
        .collect::<Vec<_>>())
}

fn asset_kind_label(kind: AssetKind) -> &'static str {
    match kind {
        AssetKind::GeoPackage => "geopackage",
        AssetKind::GeoTiff => "geotiff",
        AssetKind::Cdb => "cdb",
        AssetKind::MpegTsVideo => "mpeg-ts-video",
    }
}

#[cfg(test)]
mod runtime_asset_tests {
    use super::runtime_assets_from_root;

    #[test]
    fn existing_empty_asset_root_returns_empty_inventory() {
        let root = std::env::temp_dir().join(format!(
            "rti-empty-assets-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();

        let assets = runtime_assets_from_root(&root).unwrap();

        assert!(assets.is_empty());
        let _ = std::fs::remove_dir_all(root);
    }
}

fn fallback_runtime_assets() -> Vec<RuntimeAsset> {
    vec![
        RuntimeAsset {
            name: "korea.gpkg".to_string(),
            kind: "geopackage".to_string(),
            available: true,
        },
        RuntimeAsset {
            name: "terrain.tif".to_string(),
            kind: "geotiff".to_string(),
            available: true,
        },
        RuntimeAsset {
            name: "range.cdb".to_string(),
            kind: "cdb".to_string(),
            available: true,
        },
        RuntimeAsset {
            name: "sortie-0410.ts".to_string(),
            kind: "mpeg-ts-video".to_string(),
            available: false,
        },
        RuntimeAsset {
            name: "simdissdk".to_string(),
            kind: "simdis-sdk".to_string(),
            available: true,
        },
    ]
}

#[tauri::command]
fn demo_simdis_bridge_status() -> SimdisBridgeStatusView {
    let profile = SimdisBridgeProfile {
        name: "local-simdis".to_string(),
        target: SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 30_000),
        publish_rate_hz: 20,
        sidecar_executable: None,
        sdk_path: Some("project/vendor/simdissdk".into()),
        log_dir: "project/runtime/logs/simdis".into(),
        heartbeat_timeout_ms: 1_000,
        validation: DisValidationProfile {
            allowed_entity_range: None,
            max_pdus_per_second: 20,
        },
    };
    let (health, detail) = match sidecar_status_from_profile(&profile) {
        SimdisSidecarHealth::Connected => ("connected".to_string(), "sidecar executable configured".to_string()),
        SimdisSidecarHealth::Degraded(reason) => ("degraded".to_string(), reason),
    };
    let profile_json = profile_to_json(&profile).unwrap_or_else(|err| format!("{{\"error\":\"{}\"}}", err));
    let detail = if detail.is_empty() {
        missing_sidecar_diagnostic(&profile)
    } else {
        detail
    };
    SimdisBridgeStatusView {
        name: profile.name.clone(),
        target: profile.target.to_string(),
        publish_rate_hz: profile.publish_rate_hz,
        health,
        detail,
        profile_json,
    }
}

#[tauri::command]
fn demo_video_sync_event() -> Result<BridgeEvent, String> {
    let marker = seek_video_frame(
        &VideoSegmentIndex {
            video_id: "cam-front".to_string(),
            segments: vec![VideoSegment {
                segment_id: "seg-0001".to_string(),
                source: "video/sortie-0410.ts".to_string(),
                start_ns: 182_000_000_000,
                end_ns: 182_500_000_000,
                frame_rate_milli_hz: 30_000,
            }],
        },
        182_340_000_000,
    )?;
    Ok(BridgeEvent::VideoSyncEvent(VideoSyncEvent {
        cursor_ns: marker.cursor_ns.to_string(),
        segment_id: marker.segment_id,
        frame_ref: marker.frame_ref,
    }))
}

#[tauri::command]
fn enqueue_demo_llm_job(state: tauri::State<'_, AppState>) -> Result<Job, String> {
    let mut jobs = state.jobs.lock().map_err(|_| "job queue lock poisoned".to_string())?;
    Ok(jobs.push(JobKind::LlmEvidence, "LLM evidence preview"))
}

#[tauri::command]
fn list_jobs(state: tauri::State<'_, AppState>) -> Result<Vec<Job>, String> {
    let jobs = state.jobs.lock().map_err(|_| "job queue lock poisoned".to_string())?;
    Ok(jobs.list())
}

#[tauri::command]
fn mark_job_running(state: tauri::State<'_, AppState>, id: u64) -> Result<Vec<Job>, String> {
    let mut jobs = state.jobs.lock().map_err(|_| "job queue lock poisoned".to_string())?;
    if !jobs.mark_running(id) {
        return Err(format!("job {id} not found"));
    }
    Ok(jobs.list())
}

#[tauri::command]
fn mark_job_completed(state: tauri::State<'_, AppState>, id: u64) -> Result<Vec<Job>, String> {
    let mut jobs = state.jobs.lock().map_err(|_| "job queue lock poisoned".to_string())?;
    if !jobs.mark_completed(id) {
        return Err(format!("job {id} not found"));
    }
    Ok(jobs.list())
}

#[tauri::command]
fn mark_job_failed(state: tauri::State<'_, AppState>, id: u64) -> Result<Vec<Job>, String> {
    let mut jobs = state.jobs.lock().map_err(|_| "job queue lock poisoned".to_string())?;
    if !jobs.mark_failed(id) {
        return Err(format!("job {id} not found"));
    }
    Ok(jobs.list())
}

fn demo_evidence_graph() -> EvidenceGraph {
    let mut graph = EvidenceGraph::default();
    graph.add_node(EvidenceNode {
        id: "obs-1205".to_string(),
        kind: EvidenceNodeKind::Observation,
        label: "Hydraulic pressure spike".to_string(),
        score: 0.93,
    });
    graph.add_node(EvidenceNode {
        id: "ch-1002".to_string(),
        kind: EvidenceNodeKind::Channel,
        label: "Bus current transient".to_string(),
        score: 0.86,
    });
    graph.add_node(EvidenceNode {
        id: "ch-1210".to_string(),
        kind: EvidenceNodeKind::Channel,
        label: "Hyd bypass valve".to_string(),
        score: 0.58,
    });
    graph.add_edge(EvidenceEdge {
        source: "obs-1205".to_string(),
        target: "ch-1002".to_string(),
        kind: EvidenceEdgeKind::TemporalLead,
        weight: 0.86,
        verified: true,
    });
    graph.add_edge(EvidenceEdge {
        source: "obs-1205".to_string(),
        target: "ch-1210".to_string(),
        kind: EvidenceEdgeKind::SameSubsystem,
        weight: 0.58,
        verified: false,
    });
    graph
}

#[tauri::command]
fn demo_root_cause_candidates() -> Vec<RootCauseCandidate> {
    demo_evidence_graph().root_cause_candidates("obs-1205")
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_live_session,
            stop_live_session,
            live_session_status,
            init_demo_receiver_session,
            subscribe_panel_data,
            current_ingest_status,
            supported_panel_schemas,
            start_managed_receiver_loop,
            stop_managed_receiver_loop,
            managed_receiver_status,
            drain_managed_receiver_events,
            demo_panel_stream_event,
            demo_receiver_tick,
            export_demo_csv,
            write_demo_csv_export,
            validate_demo_llm_answer,
            build_demo_ollama_request,
            prepare_demo_matlab_handoff,
            enqueue_demo_matlab_job,
            enqueue_demo_llm_job,
            list_jobs,
            mark_job_running,
            mark_job_completed,
            mark_job_failed,
            demo_root_cause_candidates,
            demo_simdis_bridge_status,
            demo_video_sync_event,
            runtime_asset_inventory
        ])
        .run(tauri::generate_context!())
        .expect("failed to run RealTimeInsight");
}
