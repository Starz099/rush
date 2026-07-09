use rush_db::AppState;
use tauri::State;

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
