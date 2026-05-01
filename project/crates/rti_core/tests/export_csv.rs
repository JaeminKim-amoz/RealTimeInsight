use std::fs;

use rti_core::export::{build_export_manifest, build_export_manifest_for_run, export_samples_csv, write_csv_export_job, CsvExportOptions, QualityPolicy, ValueMode};
use rti_core::pcm::DecodedSample;

fn sample(channel_id: u32, raw: u32, value: f64, flags: &[&str]) -> DecodedSample {
    DecodedSample {
        channel_id,
        raw,
        value,
        timestamp: 123.5,
        quality_flags: flags.iter().map(|flag| flag.to_string()).collect(),
    }
}

#[test]
fn exports_raw_and_engineering_values() {
    let samples = vec![sample(1001, 42, 1.5, &["sync-lock", "crc-ok"])];
    let csv = export_samples_csv(
        &samples,
        &CsvExportOptions {
            quality_policy: QualityPolicy::KeepAll,
            value_mode: ValueMode::Both,
            include_metadata: true,
        },
    );

    assert!(csv.contains("# quality_policy=KeepAll,value_mode=Both"));
    assert!(csv.contains("timestamp,channel_id,raw,value,quality_flags"));
    assert!(csv.contains("123.5,1001,42,1.5,sync-lock|crc-ok"));
}

#[test]
fn good_crc_policy_excludes_bad_crc_samples() {
    let samples = vec![
        sample(1001, 1, 1.0, &["crc-ok"]),
        sample(1002, 2, 2.0, &["crc-fail"]),
    ];
    let csv = export_samples_csv(
        &samples,
        &CsvExportOptions {
            quality_policy: QualityPolicy::GoodCrcOnly,
            value_mode: ValueMode::Engineering,
            include_metadata: false,
        },
    );

    assert!(csv.contains("1001"));
    assert!(!csv.contains("1002"));
}

#[test]
fn decode_valid_policy_excludes_decode_invalid_samples() {
    let samples = vec![
        sample(1001, 1, 1.0, &["crc-fail"]),
        sample(1002, 2, 2.0, &["decode-invalid"]),
    ];
    let csv = export_samples_csv(
        &samples,
        &CsvExportOptions {
            quality_policy: QualityPolicy::DecodeValidOnly,
            value_mode: ValueMode::Raw,
            include_metadata: false,
        },
    );

    assert!(csv.contains("1001"));
    assert!(!csv.contains("1002"));
}

#[test]
fn builds_export_manifest_from_filtered_samples() {
    let samples = vec![
        sample(1002, 2, 2.0, &["crc-fail"]),
        sample(1001, 1, 1.0, &["crc-ok"]),
        sample(1001, 3, 3.0, &["crc-ok"]),
    ];
    let options = CsvExportOptions {
        quality_policy: QualityPolicy::GoodCrcOnly,
        value_mode: ValueMode::Both,
        include_metadata: true,
    };

    let manifest = build_export_manifest(&samples, &options, "csv");

    assert_eq!(manifest.format, "csv");
    assert_eq!(manifest.source_run_id, "unknown");
    assert_eq!(manifest.app_version, rti_core::VERSION);
    assert!(!manifest.created_at.is_empty());
    assert_eq!(manifest.channel_ids, vec![1001]);
    assert_eq!(manifest.row_count, 2);
    assert_eq!(manifest.range, Some((123.5, 123.5)));
}

#[test]
fn manifest_records_source_run_and_version() {
    let samples = vec![sample(1001, 1, 1.0, &["crc-ok"])];
    let options = CsvExportOptions {
        quality_policy: QualityPolicy::GoodCrcOnly,
        value_mode: ValueMode::Both,
        include_metadata: true,
    };

    let manifest = build_export_manifest_for_run(&samples, &options, "csv", "run-0410", "9.9.9");

    assert_eq!(manifest.source_run_id, "run-0410");
    assert_eq!(manifest.app_version, "9.9.9");
    assert_eq!(manifest.row_count, 1);
}

#[test]
fn writes_csv_and_manifest_files() {
    let dir = std::env::temp_dir().join(format!(
        "rti-export-test-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let samples = vec![sample(1001, 1, 1.0, &["crc-ok"])];
    let options = CsvExportOptions {
        quality_policy: QualityPolicy::GoodCrcOnly,
        value_mode: ValueMode::Both,
        include_metadata: true,
    };

    let result = write_csv_export_job(&samples, &options, &dir, "evidence").unwrap();

    let csv = fs::read_to_string(&result.csv_path).unwrap();
    let manifest = fs::read_to_string(&result.manifest_path).unwrap();
    assert!(csv.contains("1001"));
    assert!(manifest.contains("\"format\": \"csv\""));
    assert!(manifest.contains("\"sourceRunId\": \"evidence\""));
    assert!(manifest.contains("\"appVersion\":"));
    assert!(manifest.contains("\"createdAt\":"));
    assert!(manifest.contains("\"channelIds\": [1001]"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn rejects_unsafe_export_stem() {
    let options = CsvExportOptions {
        quality_policy: QualityPolicy::KeepAll,
        value_mode: ValueMode::Raw,
        include_metadata: false,
    };
    let err = write_csv_export_job(&[], &options, std::env::temp_dir(), "../bad").unwrap_err();
    assert!(err.contains("safe file stem"));
}
