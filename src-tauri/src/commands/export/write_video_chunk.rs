use crate::commands::export::types::ExportState;
use std::fs::OpenOptions;
use std::io::Write;
use tauri::ipc::{InvokeBody, Request};
use tauri::State;

#[tauri::command]
pub fn write_video_chunk(
    state: State<'_, ExportState>,
    request: Request<'_>,
) -> Result<(), String> {
    match request.body() {
        InvokeBody::Raw(bytes) => {
            let lock = state.0.lock().map_err(|e| e.to_string())?;
            if let Some(session) = lock.as_ref() {
                let mut file = OpenOptions::new()
                    .create(true)
                    .write(true)
                    .append(true)
                    .open(&session.temp_video_path)
                    .map_err(|e| format!("Failed to open temp video file: {}", e))?;

                file.write_all(bytes)
                    .map_err(|e| format!("Failed to write video chunk bytes: {}", e))?;

                Ok(())
            } else {
                Err("No active export session found. Did you call start_export?".to_string())
            }
        }
        _ => Err("Invalid payload type. Expected raw binary bytes.".to_string()),
    }
}
