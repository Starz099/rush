use crate::db::models::project::Project;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn get_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT id, name, viewport_width, viewport_height, framerate, timeline_state, created_at, updated_at 
         FROM projects ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let project_iter = stmt
        .query_map([], Project::from_row)
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for project in project_iter {
        projects.push(project.map_err(|e| e.to_string())?);
    }

    Ok(projects)
}
