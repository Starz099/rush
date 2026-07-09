use rush_db::models::clip::{BackgroundConfig, BackgroundSource, TimelineState};
use serde_json::Value;

pub fn set_background(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let color_hex = args["color_hex"].as_str();
    let gradient_colors = args["gradient_colors"].as_array();
    let blur = args["blur"].as_u64().map(|b| b as u32).unwrap_or(0);

    let source = if let Some(colors_val) = gradient_colors {
        let colors: Vec<String> = colors_val
            .iter()
            .map(|v| v.as_str().unwrap_or("#000000").to_string())
            .collect();
        BackgroundSource::Gradient {
            gradient_type: "linear".to_string(),
            colors,
            angle_degrees: Some(45.0),
        }
    } else if let Some(color) = color_hex {
        BackgroundSource::Solid {
            color_hex: color.to_string(),
        }
    } else {
        BackgroundSource::Solid {
            color_hex: "#000000".to_string(),
        }
    };

    timeline_state.background = Some(BackgroundConfig {
        source,
        blur_value: blur,
    });

    Ok("Successfully updated viewport background settings.".to_string())
}

pub fn set_playhead(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let position = args["position"]
        .as_i64()
        .ok_or_else(|| "Missing 'position' argument".to_string())? as i32;

    timeline_state.playhead_position = position;
    Ok(format!(
        "Successfully moved playhead to frame {}.",
        position
    ))
}

pub fn mute_track(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let track_id = args["track_id"]
        .as_str()
        .ok_or_else(|| "Missing 'track_id' argument".to_string())?;
    let value = args["value"]
        .as_bool()
        .ok_or_else(|| "Missing 'value' argument".to_string())?;

    if let Some(track) = timeline_state.tracks.iter_mut().find(|t| t.id == track_id) {
        track.is_muted = value;
        let status = if value { "muted" } else { "unmuted" };
        Ok(format!("Successfully {} track '{}'.", status, track_id))
    } else {
        Err(format!("Track '{}' not found.", track_id))
    }
}

pub fn lock_track(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let track_id = args["track_id"]
        .as_str()
        .ok_or_else(|| "Missing 'track_id' argument".to_string())?;
    let value = args["value"]
        .as_bool()
        .ok_or_else(|| "Missing 'value' argument".to_string())?;

    if let Some(track) = timeline_state.tracks.iter_mut().find(|t| t.id == track_id) {
        track.is_locked = value;
        let status = if value { "locked" } else { "unlocked" };
        Ok(format!("Successfully {} track '{}'.", status, track_id))
    } else {
        Err(format!("Track '{}' not found.", track_id))
    }
}
