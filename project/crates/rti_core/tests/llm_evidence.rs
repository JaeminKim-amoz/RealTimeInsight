use rti_core::llm::{answer_cites_required_evidence, build_evidence_prompt, build_ollama_chat_request, evaluate_evidence_answer, ollama_chat_request_json, EvidenceItem};

#[test]
fn builds_prompt_with_evidence_ids() {
    let prompt = build_evidence_prompt(
        "Why did hydraulic pressure spike?",
        &[
            EvidenceItem { id: "EVT-1".to_string(), label: "Hydraulic spike".to_string(), value: "+28 bar".to_string() },
            EvidenceItem { id: "CH-1002".to_string(), label: "Bus current".to_string(), value: "120 ms lead".to_string() },
        ],
    );

    assert!(prompt.prompt.contains("EVT-1"));
    assert!(prompt.prompt.contains("CH-1002"));
    assert_eq!(prompt.required_citations, vec!["EVT-1", "CH-1002"]);
}

#[test]
fn rejects_answers_without_all_citations() {
    let required = vec!["EVT-1".to_string(), "CH-1002".to_string()];

    assert!(answer_cites_required_evidence("EVT-1 and CH-1002 indicate a coupled event.", &required));
    assert!(!answer_cites_required_evidence("EVT-1 indicates a coupled event.", &required));
}

#[test]
fn evaluates_cited_and_missing_evidence() {
    let required = vec!["EVT-1".to_string(), "CH-1002".to_string()];

    let answer = evaluate_evidence_answer("EVT-1 is present", &required);

    assert_eq!(answer.cited, vec!["EVT-1"]);
    assert_eq!(answer.missing, vec!["CH-1002"]);
    assert!(!answer.accepted);
}

#[test]
fn builds_ollama_chat_request_with_evidence_prompt() {
    let prompt = build_evidence_prompt(
        "Explain anomaly",
        &[EvidenceItem { id: "EVT-1".to_string(), label: "Spike".to_string(), value: "+28 bar".to_string() }],
    );

    let request = build_ollama_chat_request(&prompt, "gemma4:31b");
    let json = ollama_chat_request_json(&request);

    assert_eq!(request.model, "gemma4:31b");
    assert!(json.contains("\"model\":\"gemma4:31b\""));
    assert!(json.contains("EVT-1"));
    assert!(json.contains("\"stream\":false"));
    assert!(json.contains("\"temperature\":0"));
}
