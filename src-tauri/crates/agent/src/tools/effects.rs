use rush_db::models::clip::{TimelineState, Transform};
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
            let mut current_transform = clip.transform.take().unwrap_or(Transform {
                x: 0.0,
                y: 0.0,
                scale: 1.0,
                z_index: 0,
            });
            if let Some(val) = x {
                current_transform.x = val;
            }
            if let Some(val) = y {
                current_transform.y = val;
            }
            if let Some(val) = scale {
                current_transform.scale = val;
            }
            clip.transform = Some(current_transform);
            found = true;
            break;
        }
    }

    if found {
        Ok(format!(
            "Successfully updated spatial transform for clip '{}'.",
            clip_id
        ))
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
                let mut current_transform = clip.transform.take().unwrap_or(Transform {
                    x: 0.0,
                    y: 0.0,
                    scale: 1.0,
                    z_index: 0,
                });
                current_transform.scale = start_scale;
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
        Ok(format!(
            "Successfully applied effect '{}' to clip '{}'.",
            effect_type, clip_id
        ))
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
        Ok(format!(
            "Successfully removed effect '{}' from clip '{}'.",
            effect_type, clip_id
        ))
    } else {
        Err(format!(
            "Effect '{}' not found or clip '{}' doesn't exist.",
            effect_type, clip_id
        ))
    }
}
