use crate::db::models::asset::Asset;
use crate::state::AppState;
use std::path::Path;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub fn register_asset(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    file_path: String,
    duration_ms: Option<i32>,
) -> Result<Asset, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist on disk".into());
    }

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown File")
        .to_string();

    let file_name_lower = file_name.to_lowercase();
    let media_type = if file_name_lower.ends_with(".mp4")
        || file_name_lower.ends_with(".mkv")
        || file_name_lower.ends_with(".mov")
    {
        "video"
    } else if file_name_lower.ends_with(".png")
        || file_name_lower.ends_with(".jpg")
        || file_name_lower.ends_with(".jpeg")
        || file_name_lower.ends_with(".webp")
        || file_name_lower.ends_with(".gif")
    {
        "image"
    } else if file_name_lower.ends_with(".mp3")
        || file_name_lower.ends_with(".wav")
        || file_name_lower.ends_with(".aac")
        || file_name_lower.ends_with(".m4a")
    {
        "audio"
    } else {
        "unknown"
    }
    .to_string();

    let id = Uuid::new_v4().to_string();
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO assets (id, project_id, name, file_path, media_type, duration_ms) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (
            &id,
            &project_id,
            &file_name,
            &file_path,
            &media_type,
            &duration_ms,
        ),
    )
    .map_err(|e| e.to_string())?;

    // Spawn background preprocessing task
    let app_handle_clone = app_handle.clone();
    let id_clone = id.clone();
    let file_path_clone = file_path.clone();
    let media_type_clone = media_type.clone();

    tokio::spawn(async move {
        if let Err(e) = crate::commands::asset::preprocess::preprocess_asset_in_background(
            app_handle_clone,
            id_clone,
            file_path_clone,
            media_type_clone,
            duration_ms,
        )
        .await
        {
            eprintln!("Error preprocessing asset in background: {}", e);
        }
    });

    let new_asset = db.query_row(
        "SELECT id, project_id, name, file_path, media_type, thumbnail_path, duration_ms, created_at 
         FROM assets WHERE id = ?1",
        [&id],
        Asset::from_row,
    ).map_err(|e| e.to_string())?;

    Ok(new_asset)
}
