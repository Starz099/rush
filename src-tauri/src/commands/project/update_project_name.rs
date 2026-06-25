use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn update_project_name(
    state: State<'_, AppState>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE projects SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        (&new_name, &id),
    )
    .map_err(|e| e.to_string())?;

    println!("Updated project name as {} for id: {}", new_name, id);

    Ok(())
}
