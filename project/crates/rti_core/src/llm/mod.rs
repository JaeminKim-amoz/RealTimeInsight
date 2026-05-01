#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvidenceItem {
    pub id: String,
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvidencePrompt {
    pub prompt: String,
    pub required_citations: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvidenceAnswer {
    pub answer: String,
    pub cited: Vec<String>,
    pub missing: Vec<String>,
    pub accepted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OllamaChatRequest {
    pub model: String,
    pub content: String,
    pub num_predict: u32,
    pub temperature_milli: u32,
}

pub fn build_evidence_prompt(question: &str, evidence: &[EvidenceItem]) -> EvidencePrompt {
    let mut prompt = String::new();
    prompt.push_str("Answer using only the evidence below. Cite evidence IDs exactly.\n");
    prompt.push_str("Question: ");
    prompt.push_str(question);
    prompt.push_str("\nEvidence:\n");
    for item in evidence {
        prompt.push_str("- ");
        prompt.push_str(&item.id);
        prompt.push_str(": ");
        prompt.push_str(&item.label);
        prompt.push_str(" = ");
        prompt.push_str(&item.value);
        prompt.push('\n');
    }
    EvidencePrompt {
        prompt,
        required_citations: evidence.iter().map(|item| item.id.clone()).collect(),
    }
}

pub fn answer_cites_required_evidence(answer: &str, required_citations: &[String]) -> bool {
    required_citations.iter().all(|citation| answer.contains(citation))
}

pub fn evaluate_evidence_answer(answer: impl Into<String>, required_citations: &[String]) -> EvidenceAnswer {
    let answer = answer.into();
    let mut cited = Vec::new();
    let mut missing = Vec::new();
    for citation in required_citations {
        if answer.contains(citation) {
            cited.push(citation.clone());
        } else {
            missing.push(citation.clone());
        }
    }
    EvidenceAnswer {
        answer,
        accepted: missing.is_empty(),
        cited,
        missing,
    }
}

pub fn build_ollama_chat_request(prompt: &EvidencePrompt, model: impl Into<String>) -> OllamaChatRequest {
    OllamaChatRequest {
        model: model.into(),
        content: prompt.prompt.clone(),
        num_predict: 512,
        temperature_milli: 0,
    }
}

pub fn ollama_chat_request_json(request: &OllamaChatRequest) -> String {
    format!(
        "{{\"model\":\"{}\",\"messages\":[{{\"role\":\"user\",\"content\":{}}}],\"stream\":false,\"options\":{{\"num_predict\":{},\"temperature\":{}}}}}",
        escape_json_string(&request.model),
        quote_json_string(&request.content),
        request.num_predict,
        request.temperature_milli as f64 / 1000.0
    )
}

fn quote_json_string(value: &str) -> String {
    format!("\"{}\"", escape_json_string(value))
}

fn escape_json_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}
