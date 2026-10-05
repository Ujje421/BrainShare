// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod project_store;
mod commands;
mod pty_manager;
mod memory_engine;
mod summarizer;
mod relay_client;

use project_store::ProjectStore;
use commands::*;
use std::sync::{Arc, Mutex};
use pty_manager::PtyState;
use tauri::Manager;

fn main() {
    let store = match ProjectStore::new() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to initialize ProjectStore: {}", e);
            std::process::exit(1);
        }
    };

    let app_state = commands::AppState {
        store: Mutex::new(store),
    };

    let pty_state = Arc::new(PtyState::new());

    tauri::Builder::default()
        .manage(app_state)
        .manage(pty_state)
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            list_projects,
            get_project,
            create_project,
            delete_project,
            read_memory_file,
            write_memory_file,
            list_memory_files,
            spawn_pty,
            write_pty,
            resize_pty,
            set_api_key,
            get_api_key,
            summarize_session
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
