use rush_db::models::project::Project;
use rush_db::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn get_project(state: State<'_, AppState>, id: String) -> Result<Project, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let project = db
        .query_row(
            "SELECT id, name, viewport_width, viewport_height, framerate, timeline_state, created_at, updated_at 
         FROM projects WHERE id = ?1",
            [&id],
            Project::from_row,
        )
        .map_err(|e| e.to_string())?;

    Ok(project)
}
