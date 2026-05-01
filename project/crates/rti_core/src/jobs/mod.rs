use std::collections::VecDeque;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum JobKind {
    LlmEvidence,
    Export,
    Matlab,
    Simdis,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: u64,
    pub kind: JobKind,
    pub status: JobStatus,
    pub label: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

#[derive(Debug, Default)]
pub struct JobQueue {
    next_id: u64,
    jobs: VecDeque<Job>,
}

impl JobQueue {
    pub fn push(&mut self, kind: JobKind, label: impl Into<String>) -> Job {
        self.next_id += 1;
        let now = now_ms();
        let job = Job {
            id: self.next_id,
            kind,
            status: JobStatus::Queued,
            label: label.into(),
            created_at_ms: now,
            updated_at_ms: now,
        };
        self.jobs.push_back(job.clone());
        job
    }

    pub fn mark_running(&mut self, id: u64) -> bool {
        self.set_status(id, JobStatus::Running)
    }

    pub fn mark_completed(&mut self, id: u64) -> bool {
        self.set_status(id, JobStatus::Completed)
    }

    pub fn mark_failed(&mut self, id: u64) -> bool {
        self.set_status(id, JobStatus::Failed)
    }

    pub fn list(&self) -> Vec<Job> {
        self.jobs.iter().cloned().collect()
    }

    fn set_status(&mut self, id: u64, status: JobStatus) -> bool {
        if let Some(job) = self.jobs.iter_mut().find(|job| job.id == id) {
            job.status = status;
            job.updated_at_ms = now_ms();
            true
        } else {
            false
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
