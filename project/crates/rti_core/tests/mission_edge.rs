use rti_core::mission_edge::{AuditLog, HandoffRequest, OperatorApproval};

#[test]
fn mission_edge_requires_operator_approval_before_handoff() {
    let request = HandoffRequest::new(
        "TAK-LOCAL",
        "Share anomaly marker",
        vec!["EVT-1".to_string(), "CH-1002".to_string()],
    );

    assert!(request.execute(None).is_err());

    let approval = OperatorApproval::new("JW", "Reviewed evidence bundle");
    let record = request.execute(Some(approval)).expect("approved handoff records audit");

    assert_eq!(record.destination, "TAK-LOCAL");
    assert_eq!(record.evidence_ids, vec!["EVT-1", "CH-1002"]);
    assert_eq!(record.operator, "JW");
}

#[test]
fn mission_edge_audit_log_is_append_only() {
    let mut log = AuditLog::default();
    let request = HandoffRequest::new("TAK-LOCAL", "Share", vec!["EVT-1".to_string()]);
    let record = request
        .execute(Some(OperatorApproval::new("AI", "Operator consent")))
        .unwrap();

    log.append(record.clone());

    assert_eq!(log.records(), &[record]);
}
