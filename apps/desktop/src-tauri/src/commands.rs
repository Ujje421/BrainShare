use crate::project_store::{ProjectStore, Project, StoreError};
use crate::pty_manager::PtyState;
use tauri::{AppHandle, State};
use std::sync::{Arc, Mutex};

// We wrap the store in a Mutex so it can be safely managed by Tauri state
pub struct AppState {
    pub store: Mutex<ProjectStore>,
}

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let store = state.store.lock().unwrap();
    store.list_projects().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    let store = state.store.lock().unwrap();
    store.get_project(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(
    name: String,
    repo_path: String,
    agent_type: String,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    let store = state.store.lock().unwrap();
    store.create_project(name, repo_path, agent_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    store.delete_project(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_memory_file(
    project_id: String,
    file_name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let store = state.store.lock().unwrap();
    store.read_memory_file(&project_id, &file_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_memory_file(
    project_id: String,
    file_name: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    store.write_memory_file(&project_id, &file_name, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_memory_files(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let store = state.store.lock().unwrap();
    store.list_memory_files(&project_id).map_err(|e| e.to_string())
}

// ── PTY Commands ──────────────────────────────────────────

#[tauri::command]
pub fn spawn_pty(
    app: AppHandle,
    project_id: String,
    repo_path: String,
    state: State<'_, Arc<PtyState>>,
    store_state: State<'_, AppState>,
) -> Result<(), String> {
    let store = store_state.store.lock().unwrap();
    let project = store.get_project(&project_id).map_err(|e| e.to_string())?;
    
    // 1. Compile memory
    if let Ok(compiled) = crate::memory_engine::compile_memory(&project_id, &store) {
        // 2. Inject into repo
        let _ = crate::memory_engine::inject_into_repo(&repo_path, &compiled, &project.agent_type);
    }
    
    // Drop lock before spawning
    drop(store);

    crate::pty_manager::spawn_pty(app, project_id, repo_path, state)
}

#[tauri::command]
pub fn write_pty(
    project_id: String,
    data: String,
    state: State<'_, Arc<PtyState>>,
) -> Result<(), String> {
    crate::pty_manager::write_pty(project_id, data, state)
}

#[tauri::command]
pub fn resize_pty(
    project_id: String,
    rows: u16,
    cols: u16,
    state: State<'_, Arc<PtyState>>,
) -> Result<(), String> {
    crate::pty_manager::resize_pty(project_id, rows, cols, state)
}

// ── Summarization (Phase 4) ───────────────────────────────

#[tauri::command]
pub fn summarize_session(
    project_id: String,
    transcript: String,
    state: State<'_, AppState>,
) -> Result<crate::summarizer::MemoryUpdates, String> {
    let api_key = match get_api_key() {
        Ok(k) if !k.is_empty() => k,
        _ => return Err("Gemini API Key is not set in Settings.".to_string()),
    };

    let store = state.store.lock().unwrap();
    crate::summarizer::summarize_session(&api_key, &transcript, &project_id, &store)
}

// ── Settings (Phase 4) ────────────────────────────────────

#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new("ProjectBrain", "gemini_api_key").map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key() -> Result<String, String> {
    let entry = keyring::Entry::new("ProjectBrain", "gemini_api_key").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(pw),
        Err(keyring::Error::NoEntry) => Ok("".to_string()),
        Err(e) => Err(e.to_string()),
    }
}
