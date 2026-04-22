use rti_core::video::{seek_video_frame, validate_video_segment_index, VideoSegment, VideoSegmentIndex};

fn index() -> VideoSegmentIndex {
    VideoSegmentIndex {
        video_id: "cam-front".to_string(),
        segments: vec![
            VideoSegment {
                segment_id: "seg-0001".to_string(),
                source: "video/sortie-0410.ts".to_string(),
                start_ns: 182_000_000_000,
                end_ns: 182_500_000_000,
                frame_rate_milli_hz: 30_000,
            },
            VideoSegment {
                segment_id: "seg-0002".to_string(),
                source: "video/sortie-0410-b.ts".to_string(),
                start_ns: 182_500_000_001,
                end_ns: 183_000_000_000,
                frame_rate_milli_hz: 30_000,
            },
        ],
    }
}

#[test]
fn validates_non_overlapping_video_segment_index() {
    validate_video_segment_index(&index()).expect("valid index");

    let mut bad = index();
    bad.segments[1].start_ns = 182_400_000_000;
    assert!(validate_video_segment_index(&bad).unwrap_err().contains("overlap"));
}

#[test]
fn rejects_unsorted_or_malformed_video_segments() {
    let mut unsorted = index();
    unsorted.segments.swap(0, 1);
    assert!(validate_video_segment_index(&unsorted).unwrap_err().contains("ordered"));

    let mut bad_source = index();
    bad_source.segments[0].source = "video/sortie.mp4".to_string();
    assert!(validate_video_segment_index(&bad_source).unwrap_err().contains("MPEG-TS"));

    let mut bad_rate = index();
    bad_rate.segments[0].frame_rate_milli_hz = 0;
    assert!(validate_video_segment_index(&bad_rate).unwrap_err().contains("frame rate"));
}

#[test]
fn seeks_cursor_to_segment_frame_reference() {
    let frame = seek_video_frame(&index(), 182_340_000_000).expect("frame found");

    assert_eq!(frame.video_id, "cam-front");
    assert_eq!(frame.segment_id, "seg-0001");
    assert_eq!(frame.cursor_ns, 182_340_000_000);
    assert_eq!(frame.frame_number, 10);
    assert_eq!(frame.frame_ref, "video://cam-front/seg-0001/10");
}

#[test]
fn seek_rejects_cursor_outside_video_timeline() {
    let err = seek_video_frame(&index(), 181_999_999_999).unwrap_err();

    assert!(err.contains("outside video timeline"));
}
