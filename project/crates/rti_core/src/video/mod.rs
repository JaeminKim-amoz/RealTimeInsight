#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoSegment {
    pub segment_id: String,
    pub source: String,
    pub start_ns: u64,
    pub end_ns: u64,
    pub frame_rate_milli_hz: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoSegmentIndex {
    pub video_id: String,
    pub segments: Vec<VideoSegment>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoFrameRef {
    pub video_id: String,
    pub segment_id: String,
    pub source: String,
    pub cursor_ns: u64,
    pub frame_number: u64,
    pub frame_ref: String,
}

pub fn validate_video_segment_index(index: &VideoSegmentIndex) -> Result<(), String> {
    if index.video_id.trim().is_empty() {
        return Err("video id must not be empty".to_string());
    }
    if index.segments.is_empty() {
        return Err("video segment index must contain at least one segment".to_string());
    }
    let mut previous_end = None;
    for segment in &index.segments {
        if segment.segment_id.trim().is_empty() {
            return Err("video segment id must not be empty".to_string());
        }
        if segment.source.trim().is_empty() || !segment.source.to_ascii_lowercase().ends_with(".ts") {
            return Err("video segment source must be an MPEG-TS path".to_string());
        }
        if segment.start_ns > segment.end_ns {
            return Err("video segment start must be <= end".to_string());
        }
        if segment.frame_rate_milli_hz == 0 {
            return Err("video segment frame rate must be non-zero".to_string());
        }
        if let Some(end) = previous_end {
            if segment.start_ns <= end {
                return Err("video segments must be ordered and must not overlap".to_string());
            }
        }
        previous_end = Some(segment.end_ns);
    }
    Ok(())
}

pub fn seek_video_frame(index: &VideoSegmentIndex, cursor_ns: u64) -> Result<VideoFrameRef, String> {
    validate_video_segment_index(index)?;
    let segment = index
        .segments
        .iter()
        .find(|segment| cursor_ns >= segment.start_ns && cursor_ns <= segment.end_ns)
        .ok_or_else(|| "cursor is outside video timeline".to_string())?;
    let elapsed_ns = cursor_ns - segment.start_ns;
    let frame_number = elapsed_ns
        .saturating_mul(segment.frame_rate_milli_hz as u64)
        / 1_000_000_000_000;
    Ok(VideoFrameRef {
        video_id: index.video_id.clone(),
        segment_id: segment.segment_id.clone(),
        source: segment.source.clone(),
        cursor_ns,
        frame_number,
        frame_ref: format!("video://{}/{}/{}", index.video_id, segment.segment_id, frame_number),
    })
}
