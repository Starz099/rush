use crate::db::models::clip::TimelineState;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn save_project_timeline(
    state: State<'_, AppState>,
    id: String,
    mut timeline_state: TimelineState,
) -> Result<TimelineState, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    for track in &mut timeline_state.tracks {
        track.validate_and_sort_clips();
    }

    let timeline_json = serde_json::to_string(&timeline_state).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE projects SET timeline_state = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        (&timeline_json, &id),
    )
    .map_err(|e| e.to_string())?;

    Ok(timeline_state)
}
