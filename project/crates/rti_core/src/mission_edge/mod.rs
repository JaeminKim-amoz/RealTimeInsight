#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandoffRequest {
    pub destination: String,
    pub action: String,
    pub evidence_ids: Vec<String>,
}

impl HandoffRequest {
    pub fn new(
        destination: impl Into<String>,
        action: impl Into<String>,
        evidence_ids: Vec<String>,
    ) -> Self {
        Self {
            destination: destination.into(),
            action: action.into(),
            evidence_ids,
        }
    }

    pub fn execute(&self, approval: Option<OperatorApproval>) -> Result<AuditRecord, String> {
        let approval = approval.ok_or_else(|| {
            "Mission Edge handoff requires explicit operator approval".to_string()
        })?;
        if self.evidence_ids.is_empty() {
            return Err("Mission Edge handoff requires evidence ids".to_string());
        }
        Ok(AuditRecord {
            destination: self.destination.clone(),
            action: self.action.clone(),
            evidence_ids: self.evidence_ids.clone(),
            operator: approval.operator,
            reason: approval.reason,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperatorApproval {
    pub operator: String,
    pub reason: String,
}

impl OperatorApproval {
    pub fn new(operator: impl Into<String>, reason: impl Into<String>) -> Self {
        Self {
            operator: operator.into(),
            reason: reason.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditRecord {
    pub destination: String,
    pub action: String,
    pub evidence_ids: Vec<String>,
    pub operator: String,
    pub reason: String,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct AuditLog {
    records: Vec<AuditRecord>,
}

impl AuditLog {
    pub fn append(&mut self, record: AuditRecord) {
        self.records.push(record);
    }

    pub fn records(&self) -> &[AuditRecord] {
        &self.records
    }
}
