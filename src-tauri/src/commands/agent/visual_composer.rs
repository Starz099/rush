use rush_db::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
#[specta::specta]
pub async fn inspect_timeline(
    app: AppHandle,
    start_frame: i32,
    end_frame: i32,
    step_frames: i32,
) -> Result<String, String> {
    rush_agent::inspect_timeline_service(app, start_frame, end_frame, step_frames).await
}

#[tauri::command]
#[specta::specta]
pub fn submit_timeline_snapshots(
    state: State<'_, AppState>,
    request_id: String,
    storyboard_base64: String,
) -> Result<(), String> {
    let mut requests = state
        .storyboard_requests
        .lock()
        .map_err(|e| e.to_string())?;

    if let Some(tx) = requests.remove(&request_id) {
        let _ = tx.send(storyboard_base64);
        Ok(())
    } else {
        Err("Request ID not found or already resolved".to_string())
    }
}
