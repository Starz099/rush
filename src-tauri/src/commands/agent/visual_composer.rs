use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InspectRequestPayload {
    request_id: String,
    start_frame: i32,
    end_frame: i32,
    step_frames: i32,
}

#[tauri::command]
#[specta::specta]
pub async fn inspect_timeline(
    app: AppHandle,
    start_frame: i32,
    end_frame: i32,
    step_frames: i32,
) -> Result<String, String> {
    let request_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();

    // Register the sender in AppState
    let state = app.state::<AppState>();
    {
        let mut requests = state
            .storyboard_requests
            .lock()
            .map_err(|e| e.to_string())?;
        requests.insert(request_id.clone(), tx);
    }

    // Emit the request event to the React frontend
    let payload = InspectRequestPayload {
        request_id: request_id.clone(),
        start_frame,
        end_frame,
        step_frames,
    };

    app.emit("inspect_timeline_request", payload)
        .map_err(|e| format!("Failed to emit inspect request: {}", e))?;

    // Await the base64 compiled storyboard image from the frontend
    let base64_image = rx
        .await
        .map_err(|e| format!("Failed to receive timeline snapshots: {}", e))?;

    Ok(base64_image)
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

    // Look up and resolve the oneshot sender, then remove it
    if let Some(tx) = requests.remove(&request_id) {
        let _ = tx.send(storyboard_base64);
        Ok(())
    } else {
        Err("Request ID not found or already resolved".to_string())
    }
}
