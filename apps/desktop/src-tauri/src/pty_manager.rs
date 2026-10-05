use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct PtyState {
    pub writers: Mutex<HashMap<String, Box<dyn Write + Send>>>,
    pub resizers: Mutex<HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            writers: Mutex::new(HashMap::new()),
            resizers: Mutex::new(HashMap::new()),
        }
    }
}

pub fn spawn_pty(
    app: AppHandle,
    project_id: String,
    repo_path: String,
    state: tauri::State<'_, Arc<PtyState>>,
) -> Result<(), String> {
    let pty_system = NativePtySystem::default();

    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let mut cmd = CommandBuilder::new("powershell.exe");
    
    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string());
        CommandBuilder::new(shell)
    };

    cmd.cwd(repo_path);
    cmd.env("PROJECTBRAIN_ACTIVE", "1");
    cmd.env("PROJECTBRAIN_PROJECT_ID", &project_id);

    let _child = pty_pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pty_pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pty_pair.master.take_writer().map_err(|e| e.to_string())?;

    {
        let mut writers = state.writers.lock().unwrap();
        writers.insert(project_id.clone(), writer);
        let mut resizers = state.resizers.lock().unwrap();
        resizers.insert(project_id.clone(), pty_pair.master);
    }

    let project_id_clone = project_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let output = String::from_utf8_lossy(&buf[..n]).to_string();
                    #[derive(Clone, serde::Serialize)]
                    #[serde(rename_all = "camelCase")]
                    struct Payload {
                        project_id: String,
                        data: String,
                    }
                    let _ = app.emit(
                        "pty_output",
                        Payload {
                            project_id: project_id_clone.clone(),
                            data: output,
                        },
                    );
                }
                Ok(_) => break,
                Err(_) => break,
            }
        }
    });

    Ok(())
}

pub fn write_pty(
    project_id: String,
    data: String,
    state: tauri::State<'_, Arc<PtyState>>,
) -> Result<(), String> {
    let mut writers = state.writers.lock().unwrap();
    if let Some(writer) = writers.get_mut(&project_id) {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn resize_pty(
    project_id: String,
    rows: u16,
    cols: u16,
    state: tauri::State<'_, Arc<PtyState>>,
) -> Result<(), String> {
    let mut resizers = state.resizers.lock().unwrap();
    if let Some(master) = resizers.get_mut(&project_id) {
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
