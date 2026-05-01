use rti_core::jobs::{JobKind, JobQueue, JobStatus};

#[test]
fn queues_jobs_with_monotonic_ids() {
    let mut queue = JobQueue::default();

    let first = queue.push(JobKind::LlmEvidence, "LLM evidence");
    let second = queue.push(JobKind::Export, "CSV export");

    assert_eq!(first.id, 1);
    assert_eq!(second.id, 2);
    assert_eq!(first.status, JobStatus::Queued);
    assert!(first.created_at_ms > 0);
    assert_eq!(first.created_at_ms, first.updated_at_ms);
}

#[test]
fn updates_job_status() {
    let mut queue = JobQueue::default();
    let job = queue.push(JobKind::LlmEvidence, "LLM evidence");

    assert!(queue.mark_running(job.id));
    assert!(queue.mark_completed(job.id));
    assert_eq!(queue.list()[0].status, JobStatus::Completed);
    assert!(queue.list()[0].updated_at_ms >= queue.list()[0].created_at_ms);
    assert!(!queue.mark_failed(999));
}
