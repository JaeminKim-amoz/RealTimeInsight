use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::pcm::DecodedSample;
use crate::VERSION;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QualityPolicy {
    KeepAll,
    GoodCrcOnly,
    DecodeValidOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValueMode {
    Raw,
    Engineering,
    Both,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CsvExportOptions {
    pub quality_policy: QualityPolicy,
    pub value_mode: ValueMode,
    pub include_metadata: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExportManifest {
    pub format: String,
    pub source_run_id: String,
    pub app_version: String,
    pub created_at: String,
    pub channel_ids: Vec<u32>,
    pub row_count: usize,
    pub quality_policy: QualityPolicy,
    pub value_mode: ValueMode,
    pub range: Option<(f64, f64)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportJobResult {
    pub csv_path: PathBuf,
    pub manifest_path: PathBuf,
}

pub fn export_samples_csv(samples: &[DecodedSample], options: &CsvExportOptions) -> String {
    let mut lines = Vec::new();
    if options.include_metadata {
        lines.push(format!(
            "# quality_policy={:?},value_mode={:?}",
            options.quality_policy, options.value_mode
        ));
    }
    lines.push(match options.value_mode {
        ValueMode::Raw => "timestamp,channel_id,raw,quality_flags".to_string(),
        ValueMode::Engineering => "timestamp,channel_id,value,quality_flags".to_string(),
        ValueMode::Both => "timestamp,channel_id,raw,value,quality_flags".to_string(),
    });

    for sample in samples.iter().filter(|sample| quality_allowed(sample, options.quality_policy)) {
        let flags = sample.quality_flags.join("|");
        lines.push(match options.value_mode {
            ValueMode::Raw => format!("{},{},{},{}", sample.timestamp, sample.channel_id, sample.raw, flags),
            ValueMode::Engineering => format!("{},{},{},{}", sample.timestamp, sample.channel_id, sample.value, flags),
            ValueMode::Both => format!(
                "{},{},{},{},{}",
                sample.timestamp, sample.channel_id, sample.raw, sample.value, flags
            ),
        });
    }
    lines.join("\n") + "\n"
}

fn quality_allowed(sample: &DecodedSample, policy: QualityPolicy) -> bool {
    match policy {
        QualityPolicy::KeepAll => true,
        QualityPolicy::GoodCrcOnly => sample.quality_flags.iter().any(|flag| flag == "crc-ok"),
        QualityPolicy::DecodeValidOnly => !sample.quality_flags.iter().any(|flag| flag == "decode-invalid"),
    }
}

pub fn build_export_manifest(
    samples: &[DecodedSample],
    options: &CsvExportOptions,
    format: impl Into<String>,
) -> ExportManifest {
    build_export_manifest_for_run(samples, options, format, "unknown", VERSION)
}

pub fn build_export_manifest_for_run(
    samples: &[DecodedSample],
    options: &CsvExportOptions,
    format: impl Into<String>,
    source_run_id: impl Into<String>,
    app_version: impl Into<String>,
) -> ExportManifest {
    let exported: Vec<&DecodedSample> = samples
        .iter()
        .filter(|sample| quality_allowed(sample, options.quality_policy))
        .collect();
    let mut channel_ids = exported
        .iter()
        .map(|sample| sample.channel_id)
        .collect::<Vec<_>>();
    channel_ids.sort_unstable();
    channel_ids.dedup();
    let range = if exported.is_empty() {
        None
    } else {
        let min = exported.iter().map(|sample| sample.timestamp).fold(f64::INFINITY, f64::min);
        let max = exported.iter().map(|sample| sample.timestamp).fold(f64::NEG_INFINITY, f64::max);
        Some((min, max))
    };
    ExportManifest {
        format: format.into(),
        source_run_id: source_run_id.into(),
        app_version: app_version.into(),
        created_at: created_at_ms_string(),
        channel_ids,
        row_count: exported.len(),
        quality_policy: options.quality_policy,
        value_mode: options.value_mode,
        range,
    }
}

pub fn write_csv_export_job(
    samples: &[DecodedSample],
    options: &CsvExportOptions,
    output_dir: impl AsRef<Path>,
    stem: &str,
) -> Result<ExportJobResult, String> {
    if stem.trim().is_empty() || stem.contains('/') || stem.contains('\\') {
        return Err("export stem must be a safe file stem".to_string());
    }
    let output_dir = output_dir.as_ref();
    fs::create_dir_all(output_dir).map_err(|err| err.to_string())?;
    let csv_path = output_dir.join(format!("{stem}.csv"));
    let manifest_path = output_dir.join(format!("{stem}.manifest.json"));
    let csv = export_samples_csv(samples, options);
    let manifest = build_export_manifest_for_run(samples, options, "csv", stem, VERSION);
    fs::write(&csv_path, csv).map_err(|err| err.to_string())?;
    fs::write(&manifest_path, manifest_to_json(&manifest)).map_err(|err| err.to_string())?;
    Ok(ExportJobResult {
        csv_path,
        manifest_path,
    })
}

fn manifest_to_json(manifest: &ExportManifest) -> String {
    let channels = manifest
        .channel_ids
        .iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(",");
    let range = manifest
        .range
        .map(|(start, end)| format!("[{start},{end}]"))
        .unwrap_or_else(|| "null".to_string());
    format!(
        "{{\n  \"format\": \"{}\",\n  \"sourceRunId\": \"{}\",\n  \"appVersion\": \"{}\",\n  \"createdAt\": \"{}\",\n  \"channelIds\": [{}],\n  \"rowCount\": {},\n  \"qualityPolicy\": \"{:?}\",\n  \"valueMode\": \"{:?}\",\n  \"range\": {}\n}}\n",
        manifest.format,
        manifest.source_run_id,
        manifest.app_version,
        manifest.created_at,
        channels,
        manifest.row_count,
        manifest.quality_policy,
        manifest.value_mode,
        range
    )
}

fn created_at_ms_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
