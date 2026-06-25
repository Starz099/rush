use crate::db::models::asset::Asset;
use crate::state::AppState;
use tauri::State;

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
