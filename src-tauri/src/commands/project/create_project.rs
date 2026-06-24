use crate::db::models::clip::{default_background, TimelineState, Track};
use crate::db::models::project::Project;
use crate::models::{FpsPreset, ResolutionPreset, TrackType};
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
