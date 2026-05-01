use rti_core::assets::{
    build_video_sync_marker, discover_assets, validate_asset_record, AssetInventory, AssetKind,
    LinkedCursor, RuntimeHealth,
};

#[test]
fn asset_inventory_reports_map_video_and_simdis_runtime_state() {
    let mut inventory = AssetInventory::default();
    inventory.register_asset("korea.gpkg", AssetKind::GeoPackage, true);
    inventory.register_asset("sortie.ts", AssetKind::MpegTsVideo, false);
    inventory.set_runtime("simdis", RuntimeHealth::Degraded("sidecar missing".to_string()));
    inventory.set_runtime("gstreamer", RuntimeHealth::Ready);

    assert_eq!(inventory.available_assets(AssetKind::GeoPackage).len(), 1);
    assert_eq!(inventory.available_assets(AssetKind::MpegTsVideo).len(), 0);
    assert_eq!(inventory.runtime("gstreamer"), Some(&RuntimeHealth::Ready));
    assert!(matches!(
        inventory.runtime("simdis"),
        Some(RuntimeHealth::Degraded(reason)) if reason == "sidecar missing"
    ));
}

#[test]
fn validates_offline_map_and_video_asset_extensions() {
    validate_asset_record("korea.gpkg", AssetKind::GeoPackage).expect("GeoPackage accepted");
    validate_asset_record("terrain.tif", AssetKind::GeoTiff).expect("GeoTIFF accepted");
    validate_asset_record("range.cdb", AssetKind::Cdb).expect("CDB accepted");
    validate_asset_record("sortie.ts", AssetKind::MpegTsVideo).expect("MPEG-TS accepted");

    assert!(validate_asset_record("online.wmts", AssetKind::GeoPackage).is_err());
    assert!(validate_asset_record("../escape.gpkg", AssetKind::GeoPackage).is_err());
}

#[test]
fn linked_cursor_builds_video_sync_marker_for_fixture_timeline() {
    let cursor = LinkedCursor {
        cursor_ns: 182_340_000_000,
        run_id: "run-0410".to_string(),
        map_entity_id: Some("track:T-247".to_string()),
        video_id: Some("cam-front".to_string()),
        linked: true,
    };

    let marker = build_video_sync_marker(&cursor, "seg-0001").expect("linked cursor has video marker");

    assert_eq!(marker.cursor_ns, "182340000000");
    assert_eq!(marker.segment_id, "seg-0001");
    assert_eq!(marker.frame_ref, "video://cam-front/182340000000");
}

#[test]
fn discovers_supported_assets_from_asset_root() {
    let root = std::env::temp_dir().join(format!(
        "rti-assets-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(root.join("maps")).unwrap();
    std::fs::create_dir_all(root.join("video")).unwrap();
    std::fs::write(root.join("maps").join("korea.gpkg"), b"gpkg").unwrap();
    std::fs::write(root.join("maps").join("terrain.tif"), b"tif").unwrap();
    std::fs::write(root.join("maps").join("range.cdb"), b"cdb").unwrap();
    std::fs::write(root.join("video").join("sortie.ts"), b"ts").unwrap();
    std::fs::write(root.join("ignore.txt"), b"ignore").unwrap();

    let inventory = discover_assets(&root).unwrap();

    let names = inventory
        .assets()
        .iter()
        .map(|asset| asset.name.as_str())
        .collect::<Vec<_>>();
    assert_eq!(names, vec![
        "maps/korea.gpkg",
        "maps/range.cdb",
        "maps/terrain.tif",
        "video/sortie.ts",
    ]);
    assert_eq!(inventory.available_assets(AssetKind::GeoPackage).len(), 1);
    assert_eq!(inventory.available_assets(AssetKind::GeoTiff).len(), 1);
    assert_eq!(inventory.available_assets(AssetKind::Cdb).len(), 1);
    assert_eq!(inventory.available_assets(AssetKind::MpegTsVideo).len(), 1);

    let _ = std::fs::remove_dir_all(root);
}
