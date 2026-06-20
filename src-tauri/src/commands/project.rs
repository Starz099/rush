use crate::db::models::clip::{default_background, EditingTool, TimelineState, Track};
use crate::db::models::project::Project;
use crate::models::{FpsPreset, ResolutionPreset, TrackType};
use crate::render::models::RenderTimeline;
use crate::render::RenderEngine;

use crate::state::AppState;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub fn create_project(
    state: State<'_, AppState>,
    name: String,
    resolution: ResolutionPreset,
    fps: FpsPreset,
) -> Result<Project, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let (width, height) = resolution.dimensions();
    let fps_val = fps.value();

    let initial_timeline = TimelineState {
        playhead_position: 0,
        tracks: vec![
            Track {
                id: "video-1".to_string(),
                name: "Video 1".to_string(),
                track_type: TrackType::Video,
                clips: vec![],
                transitions: vec![],
                is_muted: false,
                is_locked: false,
            },
            Track {
                id: "audio-1".to_string(),
                name: "Audio 1".to_string(),
                track_type: TrackType::Audio,
                clips: vec![],
                transitions: vec![],
                is_muted: false,
                is_locked: false,
            },
            Track {
                id: "effects-1".to_string(),
                name: "Effects 1".to_string(),
                track_type: TrackType::Effects,
                clips: vec![],
                transitions: vec![],
                is_muted: false,
                is_locked: false,
            },
        ],
        background: Some(default_background()),
    };
    let timeline_json = serde_json::to_string(&initial_timeline).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO projects (id, name, viewport_width, viewport_height, framerate, timeline_state) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (&id, &name, &width, &height, &fps_val, &timeline_json),
    )
    .map_err(|e| e.to_string())?;

    let new_project = db
        .query_row(
            "SELECT id, name, viewport_width, viewport_height, framerate, timeline_state, created_at, updated_at 
         FROM projects WHERE id = ?1",
            [&id],
            Project::from_row,
        )
        .map_err(|e| e.to_string())?;

    Ok(new_project)
}

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

#[tauri::command]
#[specta::specta]
pub fn delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute("DELETE FROM projects WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    println!("Deleted project with id: {}", id);

    Ok(())
}

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

#[tauri::command]
#[specta::specta]
pub fn save_project_timeline(
    state: State<'_, AppState>,
    id: String,
    timeline_state: TimelineState,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let timeline_json = serde_json::to_string(&timeline_state).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE projects SET timeline_state = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        (&timeline_json, &id),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn export_project(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    project_id: String,
    output_path: String,
) -> Result<(), String> {
    // Fetch project and compile timeline data (holding db lock only during this scope)
    let render_timeline = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let project = db
            .query_row(
                "SELECT id, name, viewport_width, viewport_height, framerate, timeline_state, created_at, updated_at
              FROM projects WHERE id = ?1",
                [&project_id],
                Project::from_row,
            )
            .map_err(|e| e.to_string())?;

        RenderTimeline::from_project(&project, &db)?
    };

    // Instantiate RenderEngine and run it (database is now unlocked and fully accessible)
    let engine = RenderEngine::new(render_timeline);
    engine.start_render(&app_handle, &output_path)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn dummy_tool_types() -> Vec<EditingTool> {
    vec![]
}
