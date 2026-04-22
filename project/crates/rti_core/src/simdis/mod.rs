#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EntityId {
    pub site: u16,
    pub application: u16,
    pub entity: u16,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EntityState {
    pub exercise_id: u8,
    pub entity_id: EntityId,
    pub force_id: u8,
    pub timestamp: u32,
    pub location: [f64; 3],
    pub velocity: [f32; 3],
    pub orientation: [f32; 3],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DisError {
    TooShort,
    UnsupportedPduType(u8),
    InvalidLength { expected: usize, actual: usize },
    InvalidEntityId,
    EntityIdNotAllowed(EntityId),
    RateLimited,
}

pub const DIS_PROTOCOL_VERSION: u8 = 7;
pub const ENTITY_STATE_PDU_TYPE: u8 = 1;
pub const ENTITY_STATE_PDU_LENGTH: usize = 144;

pub fn encode_entity_state_pdu(state: &EntityState) -> Vec<u8> {
    let mut bytes = vec![0u8; ENTITY_STATE_PDU_LENGTH];
    bytes[0] = DIS_PROTOCOL_VERSION;
    bytes[1] = state.exercise_id;
    bytes[2] = ENTITY_STATE_PDU_TYPE;
    bytes[3] = 1; // protocol family: entity information / interaction
    bytes[4..8].copy_from_slice(&state.timestamp.to_be_bytes());
    bytes[8..10].copy_from_slice(&(ENTITY_STATE_PDU_LENGTH as u16).to_be_bytes());

    bytes[12..14].copy_from_slice(&state.entity_id.site.to_be_bytes());
    bytes[14..16].copy_from_slice(&state.entity_id.application.to_be_bytes());
    bytes[16..18].copy_from_slice(&state.entity_id.entity.to_be_bytes());
    bytes[18] = state.force_id;

    let mut offset = 40;
    for value in state.velocity {
        bytes[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
        offset += 4;
    }
    for value in state.location {
        bytes[offset..offset + 8].copy_from_slice(&value.to_be_bytes());
        offset += 8;
    }
    for value in state.orientation {
        bytes[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
        offset += 4;
    }

    bytes
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SimdisBridgeProfile {
    pub name: String,
    pub target: SocketAddr,
    pub publish_rate_hz: u32,
    pub sidecar_executable: Option<PathBuf>,
    pub sdk_path: Option<PathBuf>,
    pub log_dir: PathBuf,
    pub heartbeat_timeout_ms: u64,
    pub validation: DisValidationProfile,
}

pub fn validate_bridge_profile(profile: &SimdisBridgeProfile) -> Result<(), String> {
    if profile.name.trim().is_empty() {
        return Err("SimDIS bridge profile name must not be empty".to_string());
    }
    if profile.target.port() == 0 {
        return Err("SimDIS bridge target port must be non-zero".to_string());
    }
    if profile.publish_rate_hz < 20 {
        return Err("SimDIS bridge publish rate must be >=20Hz".to_string());
    }
    if profile.heartbeat_timeout_ms == 0 {
        return Err("SimDIS sidecar heartbeat timeout must be non-zero".to_string());
    }
    if profile.validation.max_pdus_per_second < profile.publish_rate_hz {
        return Err("DIS validation rate limit must cover configured publish rate".to_string());
    }
    Ok(())
}

pub fn sidecar_status_from_profile(profile: &SimdisBridgeProfile) -> SimdisSidecarHealth {
    match (&profile.sidecar_executable, &profile.sdk_path) {
        (Some(_), _) => SimdisSidecarHealth::Connected,
        (None, Some(_)) => {
            SimdisSidecarHealth::Degraded("sidecar executable missing; SDK baseline configured".to_string())
        }
        (None, None) => SimdisSidecarHealth::Degraded("sidecar missing".to_string()),
    }
}

pub fn build_sidecar_launch_args(profile: &SimdisBridgeProfile) -> Result<Vec<String>, String> {
    validate_bridge_profile(profile)?;
    let executable = profile
        .sidecar_executable
        .as_ref()
        .ok_or_else(|| missing_sidecar_diagnostic(profile))?;
    validate_sidecar_executable_path(executable)?;
    Ok(vec![
        "--profile-json".to_string(),
        profile_to_json(profile)?,
        "--log-dir".to_string(),
        profile.log_dir.display().to_string(),
    ])
}

fn validate_sidecar_executable_path(path: &PathBuf) -> Result<(), String> {
    let raw = path.display().to_string();
    let lowered = raw.to_ascii_lowercase();
    if lowered.starts_with("http://") || lowered.starts_with("https://") {
        return Err("SimDIS sidecar executable must be local".to_string());
    }
    if path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err("SimDIS sidecar executable must not contain parent traversal".to_string());
    }
    let file_name = raw
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let allowed = ["simdis", "simdis.exe", "simdis-sidecar", "simdis-sidecar.exe"];
    if !allowed.contains(&file_name.as_str()) {
        return Err(format!("SimDIS sidecar executable is not allowlisted: {file_name}"));
    }
    Ok(())
}

pub fn profile_to_json(profile: &SimdisBridgeProfile) -> Result<String, String> {
    validate_bridge_profile(profile)?;
    let sidecar = profile
        .sidecar_executable
        .as_ref()
        .map(|path| format!("\"{}\"", escape_json(&path.display().to_string())))
        .unwrap_or_else(|| "null".to_string());
    let sdk = profile
        .sdk_path
        .as_ref()
        .map(|path| format!("\"{}\"", escape_json(&path.display().to_string())))
        .unwrap_or_else(|| "null".to_string());
    Ok(format!(
        "{{\"name\":\"{}\",\"target\":\"{}\",\"publishRateHz\":{},\"sidecarExecutable\":{},\"sdkPath\":{},\"logDir\":\"{}\",\"heartbeatTimeoutMs\":{},\"maxPdusPerSecond\":{}}}",
        escape_json(&profile.name),
        profile.target,
        profile.publish_rate_hz,
        sidecar,
        sdk,
        escape_json(&profile.log_dir.display().to_string()),
        profile.heartbeat_timeout_ms,
        profile.validation.max_pdus_per_second
    ))
}

pub fn missing_sidecar_diagnostic(profile: &SimdisBridgeProfile) -> String {
    match &profile.sdk_path {
        Some(sdk) => format!(
            "SimDIS sidecar executable missing; SDK baseline configured at {}",
            sdk.display()
        ),
        None => "SimDIS sidecar executable missing; no SDK baseline configured".to_string(),
    }
}

pub fn publish_entity_state_update(
    socket: &UdpSocket,
    profile: &SimdisBridgeProfile,
    state: &EntityState,
) -> Result<usize, String> {
    validate_bridge_profile(profile)?;
    validate_entity_state(state, &profile.validation).map_err(|err| format!("{err:?}"))?;
    let pdu = encode_entity_state_pdu(state);
    socket
        .send_to(&pdu, profile.target)
        .map_err(|err| format!("failed to publish DIS Entity State PDU: {err}"))
}

fn escape_json(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

pub fn decode_entity_state_pdu(bytes: &[u8]) -> Result<EntityState, DisError> {
    if bytes.len() < 12 {
        return Err(DisError::TooShort);
    }
    if bytes[2] != ENTITY_STATE_PDU_TYPE {
        return Err(DisError::UnsupportedPduType(bytes[2]));
    }
    let pdu_length = u16::from_be_bytes([bytes[8], bytes[9]]) as usize;
    if bytes.len() < pdu_length || pdu_length != ENTITY_STATE_PDU_LENGTH {
        return Err(DisError::InvalidLength {
            expected: ENTITY_STATE_PDU_LENGTH,
            actual: bytes.len().min(pdu_length),
        });
    }

    let entity_id = EntityId {
        site: u16::from_be_bytes([bytes[12], bytes[13]]),
        application: u16::from_be_bytes([bytes[14], bytes[15]]),
        entity: u16::from_be_bytes([bytes[16], bytes[17]]),
    };

    let mut offset = 40;
    let mut velocity = [0.0f32; 3];
    for value in &mut velocity {
        *value = f32::from_be_bytes(bytes[offset..offset + 4].try_into().unwrap());
        offset += 4;
    }
    let mut location = [0.0f64; 3];
    for value in &mut location {
        *value = f64::from_be_bytes(bytes[offset..offset + 8].try_into().unwrap());
        offset += 8;
    }
    let mut orientation = [0.0f32; 3];
    for value in &mut orientation {
        *value = f32::from_be_bytes(bytes[offset..offset + 4].try_into().unwrap());
        offset += 4;
    }

    Ok(EntityState {
        exercise_id: bytes[1],
        entity_id,
        force_id: bytes[18],
        timestamp: u32::from_be_bytes(bytes[4..8].try_into().unwrap()),
        location,
        velocity,
        orientation,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntityIdRange {
    pub min_site: u16,
    pub max_site: u16,
    pub min_application: u16,
    pub max_application: u16,
    pub min_entity: u16,
    pub max_entity: u16,
}

impl EntityIdRange {
    pub fn contains(&self, id: EntityId) -> bool {
        (self.min_site..=self.max_site).contains(&id.site)
            && (self.min_application..=self.max_application).contains(&id.application)
            && (self.min_entity..=self.max_entity).contains(&id.entity)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DisValidationProfile {
    pub allowed_entity_range: Option<EntityIdRange>,
    pub max_pdus_per_second: u32,
}

pub fn validate_entity_state(
    state: &EntityState,
    profile: &DisValidationProfile,
) -> Result<(), DisError> {
    if state.entity_id.site == 0 || state.entity_id.application == 0 || state.entity_id.entity == 0 {
        return Err(DisError::InvalidEntityId);
    }
    if let Some(range) = &profile.allowed_entity_range {
        if !range.contains(state.entity_id) {
            return Err(DisError::EntityIdNotAllowed(state.entity_id));
        }
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PduRateLimiter {
    max_per_second: u32,
    current_second: u64,
    count: u32,
}

impl PduRateLimiter {
    pub fn new(max_per_second: u32) -> Self {
        Self {
            max_per_second,
            current_second: 0,
            count: 0,
        }
    }

    pub fn admit(&mut self, timestamp_ms: u64) -> Result<(), DisError> {
        let second = timestamp_ms / 1000;
        if second != self.current_second {
            self.current_second = second;
            self.count = 0;
        }
        if self.count >= self.max_per_second {
            return Err(DisError::RateLimited);
        }
        self.count += 1;
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SimdisSidecarHealth {
    Connected,
    Degraded(String),
}

pub fn sidecar_health_from_heartbeat(now_ms: u64, last_heartbeat_ms: Option<u64>, timeout_ms: u64) -> SimdisSidecarHealth {
    match last_heartbeat_ms {
        Some(last) if now_ms.saturating_sub(last) <= timeout_ms => SimdisSidecarHealth::Connected,
        Some(_) => SimdisSidecarHealth::Degraded("heartbeat timeout".to_string()),
        None => SimdisSidecarHealth::Degraded("sidecar missing".to_string()),
    }
}
use std::net::{SocketAddr, UdpSocket};
use std::path::PathBuf;
