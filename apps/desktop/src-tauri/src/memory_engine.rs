use std::fs;
use std::path::{Path, PathBuf};
use crate::project_store::ProjectStore;

const BLOCK_START: &str = "<!-- projectbrain:start -->";
const BLOCK_END: &str = "<!-- projectbrain:end -->";

pub fn compile_memory(project_id: &str, store: &ProjectStore) -> Result<String, String> {
    let files = store.list_memory_files(project_id).map_err(|e| e.to_string())?;
    
    let mut compiled = String::new();
    compiled.push_str("# Project Context\n\n");
    compiled.push_str("This block is managed by ProjectBrain. Do not edit manually.\n\n");

    for file_name in files {
        if let Ok(content) = store.read_memory_file(project_id, &file_name) {
            compiled.push_str(&format!("## {}\n{}\n\n", file_name, content));
        }
    }

    Ok(compiled)
}

pub fn inject_into_repo(repo_path: &str, compiled_memory: &str, agent_type: &str) -> Result<(), String> {
    let target_file_name = match agent_type {
        "claude" => "CLAUDE.md",
        "cursor" => ".cursorrules",
        "aider" => "CONVENTIONS.md",
        _ => "AGENTS.md", // Default fallback
    };

    let target_path = Path::new(repo_path).join(target_file_name);
    
    let mut file_content = if target_path.exists() {
        fs::read_to_string(&target_path).unwrap_or_default()
    } else {
        String::new()
    };

    let block_content = format!("{}\n{}\n{}", BLOCK_START, compiled_memory.trim(), BLOCK_END);

    if let Some(start_idx) = file_content.find(BLOCK_START) {
        if let Some(end_idx) = file_content[start_idx..].find(BLOCK_END) {
            let actual_end_idx = start_idx + end_idx + BLOCK_END.len();
            file_content.replace_range(start_idx..actual_end_idx, &block_content);
        } else {
            // Found start but no end, append at bottom safely
            file_content.push_str("\n\n");
            file_content.push_str(&block_content);
        }
    } else {
        // No block found, append at bottom
        if !file_content.ends_with('\n') && !file_content.is_empty() {
            file_content.push('\n');
        }
        file_content.push_str("\n");
        file_content.push_str(&block_content);
    }

    fs::write(&target_path, file_content).map_err(|e| format!("Failed to write to {}: {}", target_file_name, e))?;

    Ok(())
}
