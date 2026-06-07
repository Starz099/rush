use crate::db::models::asset::Asset;
use crate::state::AppState;
use std::path::Path;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub fn register_asset(
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
    } else {
        "unknown"
    }
    .to_string();

    let id = Uuid::new_v4().to_string();
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO assets (id, project_id, name, file_path, media_type, duration_ms) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (&id, &project_id, &file_name, &file_path, &media_type, &duration_ms),
    )
    .map_err(|e| e.to_string())?;

    let new_asset = db.query_row(
        "SELECT id, project_id, name, file_path, media_type, thumbnail_path, duration_ms, created_at 
         FROM assets WHERE id = ?1",
        [&id],
        Asset::from_row,
    ).map_err(|e| e.to_string())?;

    Ok(new_asset)
}

#[tauri::command]
#[specta::specta]
pub fn get_assets(state: State<'_, AppState>, project_id: String) -> Result<Vec<Asset>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT id, project_id, name, file_path, media_type, thumbnail_path, duration_ms, created_at 
             FROM assets WHERE project_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let asset_iter = stmt
        .query_map([&project_id], Asset::from_row)
        .map_err(|e| e.to_string())?;

    let mut assets = Vec::new();
    for asset in asset_iter {
        assets.push(asset.map_err(|e| e.to_string())?);
    }

    Ok(assets)
}

#[tauri::command]
#[specta::specta]
pub fn delete_asset(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute("DELETE FROM assets WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    println!("Deleted asset with id: {}", id);

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn rename_asset(
    state: State<'_, AppState>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE assets SET name = ?1 WHERE id = ?2",
        (&new_name, &id),
    )
    .map_err(|e| e.to_string())?;

    println!("Renamed asset with id: {}", id);

    Ok(())
}
