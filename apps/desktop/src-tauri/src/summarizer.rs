use reqwest::blocking::Client;
use serde_json::json;
use crate::project_store::ProjectStore;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
}

#[derive(Deserialize, Debug)]
struct Candidate {
    content: Content,
}

#[derive(Deserialize, Debug)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Deserialize, Debug)]
struct Part {
    text: String,
}

#[derive(Deserialize, Debug)]
pub struct MemoryUpdates {
    pub status: String,
    pub conventions: String,
    pub decisions: String,
}

pub fn summarize_session(
    api_key: &str,
    transcript: &str,
    project_id: &str,
    store: &ProjectStore,
) -> Result<MemoryUpdates, String> {
    let status_current = store.read_memory_file(project_id, "status.md").unwrap_or_default();
    let conventions_current = store.read_memory_file(project_id, "conventions.md").unwrap_or_default();
    let decisions_current = store.read_memory_file(project_id, "decisions.md").unwrap_or_default();

    let prompt = format!(
        "You are the memory engine for ProjectBrain.
Your job is to analyze a raw terminal session transcript from an AI agent, and update the project's memory markdown files.
The project memory consists of three files: status.md, conventions.md, and decisions.md.
You must return a raw JSON object (with NO markdown code blocks, just raw JSON) that has three keys: 'status', 'conventions', and 'decisions'. The values should be the completely rewritten contents for those files, incorporating any new learnings or state changes from the transcript while retaining important existing information.

Current status.md:
{}

Current conventions.md:
{}

Current decisions.md:
{}

Session Transcript:
{}

Output ONLY raw JSON. No codeblocks.",
        status_current, conventions_current, decisions_current, transcript
    );

    let client = Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={}",
        api_key
    );

    let body = json!({
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    });

    let res = client
        .post(&url)
        .json(&body)
        .send()
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("API error: {}", res.text().unwrap_or_default()));
    }

    let gemini_res: GeminiResponse = res.json().map_err(|e| format!("JSON parse error: {}", e))?;
    
    let text = gemini_res.candidates.first()
        .and_then(|c| c.content.parts.first())
        .map(|p| p.text.clone())
        .ok_or("Empty response from LLM")?;

    // Sometimes LLM still wraps in ```json
    let clean_text = text.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim();

    let updates: MemoryUpdates = serde_json::from_str(clean_text)
        .map_err(|e| format!("Failed to parse LLM JSON: {}", e))?;

    Ok(updates)
}
