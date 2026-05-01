use std::collections::BTreeMap;
use std::path::{Component, Path};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetKind {
    GeoPackage,
    GeoTiff,
    Cdb,
    MpegTsVideo,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetRecord {
    pub name: String,
    pub kind: AssetKind,
    pub available: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinkedCursor {
    pub cursor_ns: u64,
    pub run_id: String,
    pub map_entity_id: Option<String>,
    pub video_id: Option<String>,
    pub linked: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoSyncMarker {
    pub cursor_ns: String,
    pub segment_id: String,
    pub frame_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeHealth {
    Ready,
    Degraded(String),
    Missing,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct AssetInventory {
    assets: Vec<AssetRecord>,
    runtimes: BTreeMap<String, RuntimeHealth>,
}

impl AssetInventory {
    pub fn register_asset(
        &mut self,
        name: impl Into<String>,
        kind: AssetKind,
        available: bool,
    ) {
        self.assets.push(AssetRecord {
            name: name.into(),
            kind,
            available,
        });
    }

    pub fn available_assets(&self, kind: AssetKind) -> Vec<&AssetRecord> {
        self.assets
            .iter()
            .filter(|asset| asset.kind == kind && asset.available)
            .collect()
    }

    pub fn assets(&self) -> &[AssetRecord] {
        &self.assets
    }

    pub fn set_runtime(&mut self, name: impl Into<String>, health: RuntimeHealth) {
        self.runtimes.insert(name.into(), health);
    }

    pub fn runtime(&self, name: &str) -> Option<&RuntimeHealth> {
        self.runtimes.get(name)
    }
}

pub fn discover_assets(root: &Path) -> Result<AssetInventory, String> {
    let mut inventory = AssetInventory::default();
    if !root.exists() {
        return Ok(inventory);
    }
    if !root.is_dir() {
        return Err("asset root must be a directory".to_string());
    }
    discover_assets_inner(root, root, &mut inventory)?;
    inventory.assets.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(inventory)
}

fn discover_assets_inner(root: &Path, dir: &Path, inventory: &mut AssetInventory) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            discover_assets_inner(root, &path, inventory)?;
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|err| err.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        if let Some(kind) = kind_from_name(&relative) {
            if validate_asset_record(&relative, kind).is_ok() {
                inventory.register_asset(relative, kind, true);
            }
        }
    }
    Ok(())
}

fn kind_from_name(name: &str) -> Option<AssetKind> {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".gpkg") {
        Some(AssetKind::GeoPackage)
    } else if lower.ends_with(".tif") || lower.ends_with(".tiff") {
        Some(AssetKind::GeoTiff)
    } else if lower.ends_with(".cdb") {
        Some(AssetKind::Cdb)
    } else if lower.ends_with(".ts") || lower.ends_with(".mts") {
        Some(AssetKind::MpegTsVideo)
    } else {
        None
    }
}

pub fn validate_asset_record(name: &str, kind: AssetKind) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("asset name must not be empty".to_string());
    }
    let path = Path::new(name);
    if path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("asset path must be relative and stay within the asset root".to_string());
    }
    let lower = name.to_ascii_lowercase();
    let ok = match kind {
        AssetKind::GeoPackage => lower.ends_with(".gpkg"),
        AssetKind::GeoTiff => lower.ends_with(".tif") || lower.ends_with(".tiff"),
        AssetKind::Cdb => lower.ends_with(".cdb"),
        AssetKind::MpegTsVideo => lower.ends_with(".ts") || lower.ends_with(".mts"),
    };
    if !ok {
        return Err(format!("asset extension does not match {kind:?}"));
    }
    Ok(())
}

pub fn build_video_sync_marker(
    cursor: &LinkedCursor,
    segment_id: impl Into<String>,
) -> Result<VideoSyncMarker, String> {
    if !cursor.linked {
        return Err("linked cursor is disabled".to_string());
    }
    let video_id = cursor
        .video_id
        .as_ref()
        .ok_or_else(|| "linked cursor has no video id".to_string())?;
    let cursor_ns = cursor.cursor_ns.to_string();
    Ok(VideoSyncMarker {
        cursor_ns: cursor_ns.clone(),
        segment_id: segment_id.into(),
        frame_ref: format!("video://{video_id}/{cursor_ns}"),
    })
}
