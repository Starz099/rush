use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn delete_asset(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute("DELETE FROM assets WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    println!("Deleted asset with id: {}", id);

    Ok(())
}
