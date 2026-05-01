use crate::ingest::IngestStore;
use crate::pcm::{decode_bytes, DecodeStats, PcmProfile};

#[derive(Debug, Clone, PartialEq)]
pub struct DatagramIngestReport {
    pub stats: DecodeStats,
    pub accepted_frames: u64,
    pub rejected_frames: u64,
    pub accepted_samples: u64,
    pub bad_frame_counters: Vec<u32>,
    pub sync_lost: bool,
}

pub fn ingest_pcm_datagram(
    store: &mut IngestStore,
    datagram: &[u8],
    profile: &PcmProfile,
) -> DatagramIngestReport {
    let decoded = decode_bytes(datagram, profile);
    let bad_frame_counters = decoded
        .bad_frames
        .iter()
        .map(|frame| frame.frame_counter)
        .collect::<Vec<_>>();
    let sync_lost = !datagram.is_empty() && decoded.stats.sync_matches == 0;
    for frame in decoded.frames.iter().chain(decoded.bad_frames.iter()) {
        store.ingest_frame(frame);
    }
    let stats = store.stats().clone();
    DatagramIngestReport {
        stats: decoded.stats,
        accepted_frames: stats.accepted_frames,
        rejected_frames: stats.rejected_frames,
        accepted_samples: stats.accepted_samples,
        bad_frame_counters,
        sync_lost,
    }
}
