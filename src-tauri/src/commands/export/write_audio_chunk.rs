use crate::commands::export::types::ExportState;
use std::fs::OpenOptions;
use std::io::Write;
use tauri::ipc::{InvokeBody, Request};
use tauri::State;

#[tauri::command]
pub fn write_audio_chunk(
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
                    .open(&session.temp_audio_path)
                    .map_err(|e| format!("Failed to open temp audio file: {}", e))?;

                file.write_all(bytes)
                    .map_err(|e| format!("Failed to write audio chunk bytes: {}", e))?;

                println!(
                    "[Backend] Appended audio chunk: {:.2} MB",
                    (bytes.len() as f64) / (1024.0 * 1024.0)
                );

                Ok(())
            } else {
                Err("No active export session found.".to_string())
            }
        }
        _ => Err("Invalid payload type. Expected raw binary bytes.".to_string()),
    }
}
