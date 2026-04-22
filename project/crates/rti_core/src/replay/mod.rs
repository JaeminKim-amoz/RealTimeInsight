use crate::pcm::DecodedSample;

#[derive(Debug, Clone, PartialEq)]
pub struct ReplayCursor {
    pub start: f64,
    pub end: f64,
    pub channel_ids: Vec<u32>,
}

impl ReplayCursor {
    pub fn new(start: f64, end: f64, channel_ids: Vec<u32>) -> Self {
        Self::try_new(start, end, channel_ids).expect("valid replay cursor")
    }

    pub fn try_new(start: f64, end: f64, channel_ids: Vec<u32>) -> Result<Self, String> {
        if start > end {
            return Err("replay cursor start must be <= end".to_string());
        }
        Ok(Self {
            start,
            end,
            channel_ids,
        })
    }

    fn includes_channel(&self, channel_id: u32) -> bool {
        self.channel_ids.is_empty() || self.channel_ids.contains(&channel_id)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReplayStore {
    run_id: String,
    decoded_samples: Vec<DecodedSample>,
}

impl ReplayStore {
    pub fn new(run_id: impl Into<String>) -> Self {
        Self {
            run_id: run_id.into(),
            decoded_samples: Vec::new(),
        }
    }

    pub fn run_id(&self) -> &str {
        &self.run_id
    }

    pub fn append_decoded_samples(&mut self, samples: Vec<DecodedSample>) {
        self.decoded_samples.extend(samples);
        self.decoded_samples
            .sort_by(|left, right| left.timestamp.total_cmp(&right.timestamp));
    }

    pub fn window(&self, cursor: &ReplayCursor) -> Vec<DecodedSample> {
        self.decoded_samples
            .iter()
            .filter(|sample| {
                sample.timestamp >= cursor.start
                    && sample.timestamp <= cursor.end
                    && cursor.includes_channel(sample.channel_id)
            })
            .cloned()
            .collect()
    }
}
