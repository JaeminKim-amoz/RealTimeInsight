use rti_core::graph::{
    EvidenceEdge, EvidenceEdgeKind, EvidenceGraph, EvidenceNode, EvidenceNodeKind,
};

fn demo_graph() -> EvidenceGraph {
    let mut graph = EvidenceGraph::default();
    graph.add_node(EvidenceNode {
        id: "obs-1205".to_string(),
        kind: EvidenceNodeKind::Observation,
        label: "Hydraulic pressure spike".to_string(),
        score: 0.93,
    });
    graph.add_node(EvidenceNode {
        id: "ch-1002".to_string(),
        kind: EvidenceNodeKind::Channel,
        label: "Bus current transient".to_string(),
        score: 0.86,
    });
    graph.add_node(EvidenceNode {
        id: "ch-1210".to_string(),
        kind: EvidenceNodeKind::Channel,
        label: "Hyd bypass valve".to_string(),
        score: 0.58,
    });
    graph.add_edge(EvidenceEdge {
        source: "obs-1205".to_string(),
        target: "ch-1002".to_string(),
        kind: EvidenceEdgeKind::TemporalLead,
        weight: 0.86,
        verified: true,
    });
    graph.add_edge(EvidenceEdge {
        source: "obs-1205".to_string(),
        target: "ch-1210".to_string(),
        kind: EvidenceEdgeKind::SameSubsystem,
        weight: 0.58,
        verified: false,
    });
    graph
}

#[test]
fn ranks_root_cause_candidates_deterministically() {
    let candidates = demo_graph().root_cause_candidates("obs-1205");

    assert_eq!(candidates.len(), 2);
    assert_eq!(candidates[0].node_id, "ch-1002");
    assert!(candidates[0].confidence > candidates[1].confidence);
    assert_eq!(candidates[0].evidence_edges, vec![EvidenceEdgeKind::TemporalLead]);
    assert_eq!(candidates[0].evidence_summary, "temporal lead, verified");
}

#[test]
fn returns_empty_candidates_for_unknown_observation() {
    assert!(demo_graph().root_cause_candidates("missing").is_empty());
}

#[test]
fn serializes_candidates_with_frontend_camel_case() {
    let candidates = demo_graph().root_cause_candidates("obs-1205");
    let json = serde_json::to_value(&candidates[0]).unwrap();

    assert_eq!(json["nodeId"], "ch-1002");
    assert!(json.get("node_id").is_none());
    assert!(json["evidenceEdges"].is_array());
    assert_eq!(json["evidenceSummary"], "temporal lead, verified");
}
