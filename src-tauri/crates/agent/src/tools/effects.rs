use rush_db::models::clip::{TimelineState};
use serde_json::Value;

pub fn update_transform(
    args: &Value,
    timeline_state: &mut TimelineState,
) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;
    let x = args["x"].as_f64().map(|v| v as f32);
    let y = args["y"].as_f64().map(|v| v as f32);
    let scale = args["scale"].as_f64().map(|v| v as f32);

    let mut found = false;
    for track in &mut timeline_state.tracks {
        if let Some(clip) = track.clips.iter_mut().find(|c| c.id == clip_id) {
            let mut current_transform = clip.transform.take().unwrap_or_default();
            if let Some(val) = x {
                current_transform.x.value = val;
            }
            if let Some(val) = y {
                current_transform.y.value = val;
            }
            if let Some(val) = scale {
                current_transform.scale.value = val;
            }
            clip.transform = Some(current_transform);
            found = true;
            break;
        }
    }

    if found {
        let receipt = serde_json::json!({
            "status": "success",
            "tool": "update_transform",
            "receipt": {
                "clip_id": clip_id,
                "x": x,
                "y": y,
                "scale": scale
            }
        });
        Ok(receipt.to_string())
    } else {
        Err(format!("Clip '{}' not found.", clip_id))
    }
}

pub fn add_effect(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;
    let effect_type = args["effect_type"]
        .as_str()
        .ok_or_else(|| "Missing 'effect_type' argument".to_string())?;
    let config = &args["config"];

    let registry = rush_db::models::presets::get_editing_registry();
    let supported_effects: Vec<String> = registry.effects.iter().map(|e| e.name.clone()).collect();
    let effect_type_lower = effect_type.to_lowercase();
    if !supported_effects.contains(&effect_type_lower) {
        return Err(format!(
                "Error: Effect '{}' is not registered in the project's editing registry. Supported effects are: {:?}",
                effect_type, supported_effects
            ));
    }

    let mut found = false;
    for track in &mut timeline_state.tracks {
        if let Some(clip) = track.clips.iter_mut().find(|c| c.id == clip_id) {
            clip.effect_type = Some(effect_type_lower.clone());
            clip.effect_config = Some(config.clone());

            // Mirror to legacy properties for video engine compatibility
            if effect_type_lower == "zoom" {
                let start_scale = config["start_scale"].as_f64().unwrap_or(1.2) as f32;
                let mut current_transform = clip.transform.take().unwrap_or_default();
                current_transform.scale.value = start_scale;
                clip.transform = Some(current_transform);
            } else if effect_type_lower == "speed" {
                let speed = config["speed_factor"].as_f64().unwrap_or(1.0) as f32;
                clip.speed_factor = speed;
            }

            found = true;
            break;
        }
    }

    if found {
        let receipt = serde_json::json!({
            "status": "success",
            "tool": "add_effect",
            "receipt": {
                "clip_id": clip_id,
                "effect_type": effect_type_lower
            }
        });
        Ok(receipt.to_string())
    } else {
        Err(format!("Clip '{}' not found.", clip_id))
    }
}

pub fn remove_effect(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;
    let effect_type = args["effect_type"]
        .as_str()
        .ok_or_else(|| "Missing 'effect_type' argument".to_string())?;

    let mut found = false;
    for track in &mut timeline_state.tracks {
        if let Some(clip) = track.clips.iter_mut().find(|c| c.id == clip_id) {
            let matches = if let Some(ref current_type) = clip.effect_type {
                current_type.eq_ignore_ascii_case(effect_type)
            } else {
                false
            };

            if matches {
                let current_type = clip.effect_type.take().unwrap();
                clip.effect_config = None;
                if current_type == "zoom" {
                    clip.transform = None;
                } else if current_type == "speed" {
                    clip.speed_factor = 1.0;
                }
                found = true;
            }
            if found {
                break;
            }
        }
    }

    if found {
        let receipt = serde_json::json!({
            "status": "success",
            "tool": "remove_effect",
            "receipt": {
                "clip_id": clip_id,
                "effect_type": effect_type
            }
        });
        Ok(receipt.to_string())
    } else {
        Err(format!(
            "Effect '{}' not found or clip '{}' doesn't exist.",
            effect_type, clip_id
        ))
    }
}
