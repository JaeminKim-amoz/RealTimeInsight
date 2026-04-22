use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EvidenceNodeKind {
    Observation,
    Channel,
    Alarm,
    CrcCluster,
    SyncLoss,
    Formula,
    VideoMarker,
    MapEntity,
    Recommendation,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EvidenceNode {
    pub id: String,
    pub kind: EvidenceNodeKind,
    pub label: String,
    pub score: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EvidenceEdgeKind {
    TemporalLead,
    FormulaDependency,
    SameFrame,
    SameSubsystem,
    Correlation,
    UserConfirmed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EvidenceEdge {
    pub source: String,
    pub target: String,
    pub kind: EvidenceEdgeKind,
    pub weight: f64,
    pub verified: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootCauseCandidate {
    pub node_id: String,
    pub label: String,
    pub confidence: f64,
    pub evidence_edges: Vec<EvidenceEdgeKind>,
    pub evidence_summary: String,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct EvidenceGraph {
    pub nodes: Vec<EvidenceNode>,
    pub edges: Vec<EvidenceEdge>,
}

impl EvidenceGraph {
    pub fn add_node(&mut self, node: EvidenceNode) {
        self.nodes.push(node);
    }

    pub fn add_edge(&mut self, edge: EvidenceEdge) {
        self.edges.push(edge);
    }

    pub fn root_cause_candidates(&self, observation_id: &str) -> Vec<RootCauseCandidate> {
        let mut candidates = self
            .edges
            .iter()
            .filter(|edge| edge.source == observation_id || edge.target == observation_id)
            .filter_map(|edge| {
                let node_id = if edge.source == observation_id {
                    &edge.target
                } else {
                    &edge.source
                };
                let node = self.nodes.iter().find(|node| node.id == *node_id)?;
                let verified_boost = if edge.verified { 0.08 } else { 0.0 };
                let kind_boost = match edge.kind {
                    EvidenceEdgeKind::TemporalLead => 0.08,
                    EvidenceEdgeKind::FormulaDependency => 0.06,
                    EvidenceEdgeKind::SameFrame => 0.05,
                    EvidenceEdgeKind::UserConfirmed => 0.1,
                    EvidenceEdgeKind::SameSubsystem | EvidenceEdgeKind::Correlation => 0.0,
                };
                Some(RootCauseCandidate {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    confidence: (node.score * edge.weight + verified_boost + kind_boost).min(1.0),
                    evidence_edges: vec![edge.kind.clone()],
                    evidence_summary: summarize_edge(&edge.kind, edge.verified),
                })
            })
            .collect::<Vec<_>>();

        candidates.sort_by(|a, b| {
            b.confidence
                .partial_cmp(&a.confidence)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.node_id.cmp(&b.node_id))
        });
        candidates
    }
}

fn summarize_edge(kind: &EvidenceEdgeKind, verified: bool) -> String {
    let relation = match kind {
        EvidenceEdgeKind::TemporalLead => "temporal lead",
        EvidenceEdgeKind::FormulaDependency => "formula dependency",
        EvidenceEdgeKind::SameFrame => "same frame locality",
        EvidenceEdgeKind::SameSubsystem => "same subsystem",
        EvidenceEdgeKind::Correlation => "correlation",
        EvidenceEdgeKind::UserConfirmed => "user-confirmed relation",
    };
    if verified {
        format!("{relation}, verified")
    } else {
        format!("{relation}, inferred")
    }
}
