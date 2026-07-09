use rush_db::models::clip::{EaseCurve, EffectConfig, Shape, TimelineState, Transform};
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
            match effect_type.to_lowercase().as_str() {
                "zoom" => {
                    let start_scale = config["start_scale"].as_f64().unwrap_or(1.0) as f32;
                    let end_scale = config["end_scale"].as_f64().unwrap_or(1.2) as f32;
                    let center_x = config["center_x"].as_f64().unwrap_or(0.0) as f32;
                    let center_y = config["center_y"].as_f64().unwrap_or(0.0) as f32;
                    let ease_curve = match config["ease_curve"].as_str().unwrap_or("ease_in") {
                        "ease_out" => EaseCurve::EaseOut,
                        "linear" => EaseCurve::Linear,
                        _ => EaseCurve::EaseIn,
                    };
                    clip.effects.push(EffectConfig::Zoom {
                        start_scale,
                        end_scale,
                        center_x,
                        center_y,
                        ease_curve,
                    });
                }
                "text_overlay" => {
                    let text = config["text"]
                        .as_str()
                        .unwrap_or("Text Overlay")
                        .to_string();
                    let font_family = config["font_family"]
                        .as_str()
                        .unwrap_or("Outfit")
                        .to_string();
                    let font_size = config["font_size"].as_i64().unwrap_or(48) as i32;
                    let color_hex = config["color_hex"]
                        .as_str()
                        .unwrap_or("#FFFFFF")
                        .to_string();
                    clip.effects.push(EffectConfig::TextOverlay {
                        text,
                        font_family,
                        font_size,
                        color_hex,
                    });
                }
                "highlight" => {
                    let shape = match config["shape"].as_str().unwrap_or("rectangle") {
                        "circle" => Shape::Circle,
                        "arrow" => Shape::Arrow,
                        "highlighter" => Shape::Highlighter,
                        _ => Shape::Rectangle,
                    };
                    let color_hex = config["color_hex"]
                        .as_str()
                        .unwrap_or("#FFFC00")
                        .to_string();
                    let stroke_width = config["stroke_width"].as_i64().unwrap_or(4) as i32;
                    let animation = config["animation"].as_str().unwrap_or("fade").to_string();
                    clip.effects.push(EffectConfig::Highlight {
                        shape,
                        color_hex,
                        stroke_width,
                        animation,
                    });
                }
                "speed" => {
                    let speed = config["speed_factor"].as_f64().unwrap_or(1.0) as f32;
                    clip.speed_factor = speed;
                }
                _ => return Err(format!("Unknown effect type: '{}'", effect_type)),
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
            match effect_type.to_lowercase().as_str() {
                "speed" => {
                    clip.speed_factor = 1.0;
                    found = true;
                }
                other => {
                    let original_len = clip.effects.len();
                    clip.effects.retain(|effect| {
                        let name = match effect {
                            EffectConfig::Zoom { .. } => "zoom",
                            EffectConfig::TextOverlay { .. } => "text_overlay",
                            EffectConfig::Highlight { .. } => "highlight",
                        };
                        name != other
                    });
                    if clip.effects.len() < original_len {
                        found = true;
                    }
                }
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
