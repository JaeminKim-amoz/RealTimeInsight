use std::collections::HashMap;

use crate::pcm::{DecodedFrame, DecodedSample};

pub mod managed;
pub mod udp;
pub mod pipeline;
pub mod receiver;

#[derive(Debug, Clone, Default)]
pub struct IngestStats {
    pub accepted_frames: u64,
    pub rejected_frames: u64,
    pub accepted_samples: u64,
}

#[derive(Debug, Clone)]
pub struct SampleRing {
    capacity: usize,
    samples: Vec<DecodedSample>,
}

#[derive(Debug, Clone)]
pub struct IngestStore {
    capacity_per_channel: usize,
    channels: HashMap<u32, SampleRing>,
    stats: IngestStats,
}

impl SampleRing {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            samples: Vec::with_capacity(capacity),
        }
    }

    pub fn push(&mut self, sample: DecodedSample) {
        if self.capacity == 0 {
            return;
        }
        if self.samples.len() == self.capacity {
            self.samples.remove(0);
        }
        self.samples.push(sample);
    }

    pub fn snapshot(&self) -> &[DecodedSample] {
        &self.samples
    }
}

impl IngestStore {
    pub fn new(capacity_per_channel: usize) -> Self {
        Self {
            capacity_per_channel,
            channels: HashMap::new(),
            stats: IngestStats::default(),
        }
    }

    pub fn ingest_frame(&mut self, frame: &DecodedFrame) {
        if !frame.crc_ok {
            self.stats.rejected_frames += 1;
            return;
        }

        self.stats.accepted_frames += 1;
        for sample in &frame.samples {
            self.channels
                .entry(sample.channel_id)
                .or_insert_with(|| SampleRing::new(self.capacity_per_channel))
                .push(sample.clone());
            self.stats.accepted_samples += 1;
        }
    }

    pub fn channel_snapshot(&self, channel_id: u32) -> &[DecodedSample] {
        self.channels
            .get(&channel_id)
            .map(SampleRing::snapshot)
            .unwrap_or(&[])
    }

    pub fn samples_snapshot(&self, channel_ids: Option<&[u32]>) -> Vec<DecodedSample> {
        let mut samples = Vec::new();
        for (channel_id, ring) in &self.channels {
            if channel_ids
                .map(|ids| ids.contains(channel_id))
                .unwrap_or(true)
            {
                samples.extend_from_slice(ring.snapshot());
            }
        }
        samples.sort_by(|left, right| {
            left.timestamp
                .total_cmp(&right.timestamp)
                .then_with(|| left.channel_id.cmp(&right.channel_id))
        });
        samples
    }

    pub fn stats(&self) -> &IngestStats {
        &self.stats
    }
}
