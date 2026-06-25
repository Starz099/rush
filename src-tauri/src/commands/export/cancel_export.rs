use crate::commands::export::types::ExportState;
use tauri::State;

#[tauri::command]
pub fn cancel_export(state: State<'_, ExportState>) -> Result<(), String> {
    println!("[Backend] Cancelling export session.");
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(session) = lock.take() {
        let _ = std::fs::remove_file(&session.temp_video_path);
        let _ = std::fs::remove_file(&session.temp_audio_path);

        // Also remove final output file if it has started being written or muxed
        if let Ok(path) = std::path::PathBuf::from(&session.final_output_path).canonicalize() {
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
        } else {
            let path = std::path::Path::new(&session.final_output_path);
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
        }

        println!("[Backend] Cleaned up temporary files for cancelled export session.");
    }
    Ok(())
}
