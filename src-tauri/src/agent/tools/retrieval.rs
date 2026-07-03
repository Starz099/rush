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
