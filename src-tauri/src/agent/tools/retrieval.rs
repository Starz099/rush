use crate::agent::context::asset::format_assets;
use crate::agent::context::timeline::format_timeline;
use crate::db::models::asset::Asset;
use crate::db::models::clip::TimelineState;
use serde_json::Value;

pub fn get_project_metadata(
    project_name: &str,
    viewport_width: i32,
    viewport_height: i32,
    framerate: i32,
    timeline_state: &TimelineState,
) -> Result<String, String> {
    let background_str =
        serde_json::to_string(&timeline_state.background).unwrap_or_else(|_| "None".to_string());

    Ok(format!(
        "Project Name: {}\nResolution: {}x{}\nFramerate: {} FPS\nBackground: {}\nPlayhead Position: {} frames",
        project_name,
        viewport_width,
        viewport_height,
        framerate,
        background_str,
        timeline_state.playhead_position
    ))
}

pub fn get_assets_list(assets: &[Asset]) -> Result<String, String> {
    Ok(format_assets(assets))
}

pub fn get_timeline_layout(timeline_state: &TimelineState) -> Result<String, String> {
    if timeline_state.tracks.is_empty() {
        return Ok("Timeline is currently empty (no tracks).".to_string());
    }

    let mut output = String::from("Timeline Tracks:\n");
    for (i, track) in timeline_state.tracks.iter().enumerate() {
        output.push_str(&format!(
            "- Index: {}\n  ID: '{}'\n  Name: '{}'\n  Type: '{:?}'\n  Muted: {}\n  Locked: {}\n  Clips Count: {}\n\n",
            i + 1,
            track.id,
            track.name,
            track.track_type,
            track.is_muted,
            track.is_locked,
            track.clips.len()
        ));
    }
    Ok(output)
}

pub fn get_track_details(args: &Value, timeline_state: &TimelineState) -> Result<String, String> {
    let track_id = args["track_id"]
        .as_str()
        .ok_or_else(|| "Missing 'track_id' argument".to_string())?;

    let track = timeline_state
        .tracks
        .iter()
        .find(|t| t.id == track_id)
        .ok_or_else(|| format!("Track '{}' not found on the timeline.", track_id))?;

    Ok(format_timeline(std::slice::from_ref(track)))
}

pub fn get_timeline_transcript(
    args: &Value,
    timeline_state: &TimelineState,
    framerate: i32,
    app: &tauri::AppHandle,
) -> Result<String, String> {
    use crate::state::AppState;
    use tauri::Manager;

    let start_frame = args["start_frame"].as_i64().ok_or("Missing start_frame")? as i32;
    let end_frame = args["end_frame"].as_i64().ok_or("Missing end_frame")? as i32;

    let db_state = app.state::<AppState>();
    let db = db_state.db.lock().map_err(|e| e.to_string())?;

    let composed = crate::asset_processor::composer::audio::compose_transcript(
        &db,
        timeline_state,
        framerate,
        start_frame,
        end_frame,
    )?;

    Ok(composed.text)
}

pub async fn inspect_timeline(
    args: &Value,
    app: tauri::AppHandle,
    framerate: i32,
) -> Result<String, String> {
    let start_frame = args["start_frame"].as_i64().ok_or("Missing start_frame")? as i32;
    let end_frame = args["end_frame"].as_i64().ok_or("Missing end_frame")? as i32;
    let default_step = (framerate as i64 / 4).max(1);
    let step_frames = args["step_frames"].as_i64().unwrap_or(default_step) as i32;

    let base64_image = crate::commands::agent::visual_composer::inspect_timeline(
        app,
        start_frame,
        end_frame,
        step_frames,
    )
    .await?;

    Ok(format!("[STORYBOARD_IMAGE:base64:{}]", base64_image))
}
