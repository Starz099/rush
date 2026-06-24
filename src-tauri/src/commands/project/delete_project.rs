use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute("DELETE FROM projects WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    println!("Deleted project with id: {}", id);

    Ok(())
}
