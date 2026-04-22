use std::collections::HashMap;

use crate::pcm::DecodedSample;

#[derive(Debug, Clone, PartialEq)]
pub struct DataRefChunk {
    pub data_ref: String,
    pub samples: Vec<DecodedSample>,
}

#[derive(Debug, Clone)]
pub struct DataRefRegistry {
    namespace: String,
    next_seq: u64,
    chunks: HashMap<String, Vec<DecodedSample>>,
}

impl DataRefRegistry {
    pub fn new(namespace: impl Into<String>) -> Self {
        Self {
            namespace: namespace.into(),
            next_seq: 1,
            chunks: HashMap::new(),
        }
    }

    pub fn insert_samples(
        &mut self,
        subscription_id: &str,
        samples: Vec<DecodedSample>,
    ) -> DataRefChunk {
        let data_ref = format!("buffer://rti/{}/{}/{}", self.namespace, subscription_id, self.next_seq);
        self.next_seq += 1;
        self.chunks.insert(data_ref.clone(), samples.clone());
        DataRefChunk { data_ref, samples }
    }

    pub fn get(&self, data_ref: &str) -> Option<&[DecodedSample]> {
        self.chunks.get(data_ref).map(Vec::as_slice)
    }

    pub fn release(&mut self, data_ref: &str) -> bool {
        self.chunks.remove(data_ref).is_some()
    }

    pub fn len(&self) -> usize {
        self.chunks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.chunks.is_empty()
    }
}
