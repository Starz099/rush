use crate::asset_processor::composer::audio::{compose_transcript, ComposedTranscript};
use crate::db::models::project::Project;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn get_timeline_transcript(
    state: State<'_, AppState>,
    project_id: String,
    start_frame: i32,
    end_frame: i32,
) -> Result<ComposedTranscript, String> {
    let db = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    let project: Project = db
            .query_row(
                "SELECT id, name, viewport_width, viewport_height, framerate, timeline_state, created_at, updated_at
                 FROM projects WHERE id = ?1",
                [&project_id],
                Project::from_row,
            )
            .map_err(|e| format!("Failed to find project: {}", e))?;

    let composed = compose_transcript(
        &db,
        &project.timeline_state,
        project.framerate,
        start_frame,
        end_frame,
    )?;

    Ok(composed)
}
