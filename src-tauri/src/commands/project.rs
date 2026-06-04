use crate::db::models::project::Project;
use crate::state::AppState;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    name: String,
    width: i32,
    height: i32,
    fps: i32,
) -> Result<Project, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();

    db.execute(
        "INSERT INTO projects (id, name, viewport_width, viewport_height, framerate) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        (&id, &name, &width, &height, &fps),
    )
    .map_err(|e| e.to_string())?;

    let new_project = db
        .query_row(
            "SELECT id, name, viewport_width, viewport_height, framerate, created_at, updated_at 
         FROM projects WHERE id = ?1",
            [&id],
            Project::from_row,
        )
        .map_err(|e| e.to_string())?;

    Ok(new_project)
}

#[tauri::command]
pub fn get_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT id, name, viewport_width, viewport_height, framerate, created_at, updated_at 
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

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute("DELETE FROM projects WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    println!("Deleted project with id: {}", id);

    Ok(())
}

#[tauri::command]
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
