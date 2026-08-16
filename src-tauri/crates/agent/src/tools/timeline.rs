use rush_db::models::asset::Asset;
use rush_db::models::clip::{Adjustments, Clip, TimelineState, Track, Transform};
use rush_db::models::presets::TrackType;
use serde_json::Value;
use uuid::Uuid;

pub fn add_clip(
    args: &Value,
    timeline_state: &mut TimelineState,
    assets: &[Asset],
) -> Result<String, String> {
    let track_id = args["track_id"]
        .as_str()
        .ok_or_else(|| "Missing 'track_id' argument".to_string())?;
    let asset_id = args["asset_id"]
        .as_str()
        .ok_or_else(|| "Missing 'asset_id' argument".to_string())?;
    let timeline_in = args["timeline_in"]
        .as_i64()
        .ok_or_else(|| "Missing 'timeline_in' argument".to_string())? as i32;
    let duration_frames = args["duration_frames"]
        .as_i64()
        .ok_or_else(|| "Missing 'duration_frames' argument".to_string())?
        as i32;

    let asset = assets
        .iter()
        .find(|a| a.id == asset_id)
        .ok_or_else(|| format!("Asset not found: {}", asset_id))?;

    let track_type = match asset.media_type.to_lowercase().as_str() {
        "audio" | "music" | "voice" => TrackType::Audio,
        _ => TrackType::Video,
    };

    let track = if let Some(idx) = timeline_state.tracks.iter().position(|t| t.id == track_id) {
        &mut timeline_state.tracks[idx]
    } else if let Some(idx) = timeline_state
        .tracks
        .iter()
        .position(|t| t.track_type == track_type)
    {
        &mut timeline_state.tracks[idx]
    } else {
        let new_track = Track {
            id: track_id.to_string(),
            name: format!("Track {}", timeline_state.tracks.len() + 1),
            track_type,
            clips: vec![],
            transitions: vec![],
            is_muted: false,
            is_locked: false,
        };
        timeline_state.tracks.push(new_track);
        let len = timeline_state.tracks.len();
        &mut timeline_state.tracks[len - 1]
    };

    let clip_out = timeline_in + duration_frames;
    let clip = Clip {
        id: Uuid::new_v4().to_string(),
        asset_id: Some(asset_id.to_string()),
        timeline_in,
        timeline_out: clip_out,
        source_in: 0,
        source_out: duration_frames,
        transform: Some(Transform::default()),
        clip_transitions: None,
        speed_factor: 1.0,
        effect_type: None,
        effect_config: None,
        adjustments: None,
    };

    track.clips.push(clip.clone());
    track.validate_and_sort_clips();

    let receipt = serde_json::json!({
        "status": "success",
        "tool": "add_clip",
        "receipt": {
            "clip_id": clip.id,
            "track_id": track.id,
            "timeline_in": timeline_in,
            "timeline_out": clip_out
        }
    });

    Ok(receipt.to_string())
}

pub fn delete_clip(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;

    let mut found = false;
    for track in &mut timeline_state.tracks {
        if let Some(pos) = track.clips.iter().position(|c| c.id == clip_id) {
            track.clips.remove(pos);
            track.validate_and_sort_clips();
            found = true;
            break;
        }
    }

    if found {
        let receipt = serde_json::json!({
            "status": "success",
            "tool": "delete_clip",
            "receipt": {
                "clip_id": clip_id
            }
        });
        Ok(receipt.to_string())
    } else {
        Err(format!("Clip '{}' not found in any track.", clip_id))
    }
}

pub fn move_clip(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;
    let new_timeline_in = args["new_timeline_in"]
        .as_i64()
        .ok_or_else(|| "Missing 'new_timeline_in' argument".to_string())?
        as i32;
    let new_track_id = args["new_track_id"].as_str();

    let mut found_clip = None;
    let mut source_track_idx = None;

    // Find and remove clip from its original track
    for (t_idx, track) in timeline_state.tracks.iter_mut().enumerate() {
        if let Some(pos) = track.clips.iter().position(|c| c.id == clip_id) {
            let mut clip = track.clips.remove(pos);
            track.validate_and_sort_clips(); // Validate source track
            let duration = clip.timeline_out - clip.timeline_in;
            clip.timeline_in = new_timeline_in;
            clip.timeline_out = new_timeline_in + duration;
            found_clip = Some(clip);
            source_track_idx = Some(t_idx);
            break;
        }
    }

    let clip = found_clip.ok_or_else(|| format!("Clip '{}' not found in any track.", clip_id))?;

    if let Some(target_track_id) = new_track_id {
        // Insert into target track
        let target_idx = timeline_state
            .tracks
            .iter()
            .position(|t| t.id == target_track_id)
            .ok_or_else(|| format!("Target track '{}' not found.", target_track_id))?;
        let target_track = &mut timeline_state.tracks[target_idx];
        let clip_out = clip.timeline_out;
        target_track.clips.push(clip);
        target_track.validate_and_sort_clips();

        let receipt = serde_json::json!({
            "status": "success",
            "tool": "move_clip",
            "receipt": {
                "clip_id": clip_id,
                "track_id": target_track_id,
                "timeline_in": new_timeline_in,
                "timeline_out": clip_out
            }
        });
        Ok(receipt.to_string())
    } else {
        // Put back in original track at new position
        let source_idx = source_track_idx.ok_or_else(|| "Source track idx mismatch".to_string())?;
        let source_track = &mut timeline_state.tracks[source_idx];
        let track_id = source_track.id.clone();
        let clip_out = clip.timeline_out;
        source_track.clips.push(clip);
        source_track.validate_and_sort_clips();

        let receipt = serde_json::json!({
            "status": "success",
            "tool": "move_clip",
            "receipt": {
                "clip_id": clip_id,
                "track_id": track_id,
                "timeline_in": new_timeline_in,
                "timeline_out": clip_out
            }
        });
        Ok(receipt.to_string())
    }
}

pub fn trim_clip(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;
    let timeline_in = args["timeline_in"].as_i64();
    let timeline_out = args["timeline_out"].as_i64();
    let source_in = args["source_in"].as_i64();
    let source_out = args["source_out"].as_i64();

    let mut receipt_json = None;
    for track in &mut timeline_state.tracks {
        let mut found_clip = None;
        if let Some(clip) = track.clips.iter_mut().find(|c| c.id == clip_id) {
            if let Some(val) = timeline_in {
                clip.timeline_in = val as i32;
            }
            if let Some(val) = timeline_out {
                clip.timeline_out = val as i32;
            }
            if let Some(val) = source_in {
                clip.source_in = val as i32;
            }
            if let Some(val) = source_out {
                clip.source_out = val as i32;
            }
            found_clip = Some((
                clip.timeline_in,
                clip.timeline_out,
                clip.source_in,
                clip.source_out,
            ));
        }

        if let Some((t_in, t_out, s_in, s_out)) = found_clip {
            track.validate_and_sort_clips();
            receipt_json = Some(serde_json::json!({
                "status": "success",
                "tool": "trim_clip",
                "receipt": {
                    "clip_id": clip_id,
                    "timeline_in": t_in,
                    "timeline_out": t_out,
                    "source_in": s_in,
                    "source_out": s_out
                }
            }));
            break;
        }
    }

    if let Some(receipt) = receipt_json {
        Ok(receipt.to_string())
    } else {
        Err(format!("Clip '{}' not found in any track.", clip_id))
    }
}

pub fn split_clip(args: &Value, timeline_state: &mut TimelineState) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;
    let split_frame = args["split_frame"]
        .as_i64()
        .ok_or_else(|| "Missing 'split_frame' argument".to_string())? as i32;

    let mut found_track_idx = None;
    let mut found_clip_idx = None;

    for (t_idx, track) in timeline_state.tracks.iter().enumerate() {
        if let Some(c_idx) = track.clips.iter().position(|c| c.id == clip_id) {
            found_track_idx = Some(t_idx);
            found_clip_idx = Some(c_idx);
            break;
        }
    }

    let track_idx = found_track_idx.ok_or_else(|| format!("Clip '{}' not found.", clip_id))?;
    let clip_idx = found_clip_idx.unwrap();
    let track = &mut timeline_state.tracks[track_idx];
    let clip = &track.clips[clip_idx];

    if split_frame <= clip.timeline_in || split_frame >= clip.timeline_out {
        return Err(format!(
            "Split position {} is outside clip bounds [{} -> {}].",
            split_frame, clip.timeline_in, clip.timeline_out
        ));
    }

    let speed = clip.speed_factor;

    // Calculate source frames representing the split boundary
    let frames_from_start = split_frame - clip.timeline_in;
    let source_split_offset = (frames_from_start as f32 * speed) as i32;
    let split_source_frame = clip.source_in + source_split_offset;

    let mut clip_a = clip.clone();
    clip_a.id = Uuid::new_v4().to_string();
    clip_a.timeline_out = split_frame;
    clip_a.source_out = split_source_frame;

    let mut clip_b = clip.clone();
    clip_b.id = Uuid::new_v4().to_string();
    clip_b.timeline_in = split_frame;
    clip_b.source_in = split_source_frame;

    // Remove original clip, insert A and B
    track.clips.remove(clip_idx);
    track.clips.push(clip_a.clone());
    track.clips.push(clip_b.clone());
    track.validate_and_sort_clips();

    let receipt = serde_json::json!({
        "status": "success",
        "tool": "split_clip",
        "receipt": {
            "original_clip_id": clip_id,
            "split_frame": split_frame,
            "left_clip_id": clip_a.id,
            "right_clip_id": clip_b.id
        }
    });
    Ok(receipt.to_string())
}

pub fn close_timeline_gaps(
    args: &Value,
    timeline_state: &mut TimelineState,
) -> Result<String, String> {
    let track_id = args["track_id"]
        .as_str()
        .ok_or_else(|| "Missing 'track_id' argument".to_string())?;
    let preserve_start = args["preserve_start"].as_bool().unwrap_or(false);

    let idx = timeline_state
        .tracks
        .iter()
        .position(|t| t.id == track_id)
        .ok_or_else(|| format!("Track '{}' not found.", track_id))?;

    let track = &mut timeline_state.tracks[idx];

    if track.clips.is_empty() {
        return Ok(format!(
            "Track '{}' has no clips, no gaps to close.",
            track.name
        ));
    }

    // Sort clips chronologically by start frame
    track.clips.sort_by_key(|c| c.timeline_in);

    let mut current_timeline_cursor = if preserve_start {
        track.clips[0].timeline_in
    } else {
        0
    };

    let mut changes_count = 0;

    for clip in &mut track.clips {
        let duration = clip.timeline_out - clip.timeline_in;

        if clip.timeline_in != current_timeline_cursor {
            clip.timeline_in = current_timeline_cursor;
            clip.timeline_out = current_timeline_cursor + duration;
            changes_count += 1;
        }

        current_timeline_cursor = clip.timeline_out;
    }

    track.validate_and_sort_clips();

    let receipt = serde_json::json!({
        "status": "success",
        "tool": "close_timeline_gaps",
        "receipt": {
            "track_id": track_id,
            "clips_adjusted": changes_count,
            "preserve_start": preserve_start
        }
    });
    Ok(receipt.to_string())
}

pub fn ripple_delete_clip(
    args: &Value,
    timeline_state: &mut TimelineState,
) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;

    let mut found_track_idx = None;
    let mut deleted_clip_in = 0;
    let mut deleted_clip_duration = 0;

    for (t_idx, track) in timeline_state.tracks.iter().enumerate() {
        if let Some(clip) = track.clips.iter().find(|c| c.id == clip_id) {
            found_track_idx = Some(t_idx);
            deleted_clip_in = clip.timeline_in;
            deleted_clip_duration = clip.timeline_out - clip.timeline_in;
            break;
        }
    }

    let track_idx =
        found_track_idx.ok_or_else(|| format!("Clip '{}' not found in any track.", clip_id))?;
    let track = &mut timeline_state.tracks[track_idx];

    // Remove the target clip
    if let Some(pos) = track.clips.iter().position(|c| c.id == clip_id) {
        track.clips.remove(pos);
    }

    // Shift all subsequent clips on this track to the left by the deleted clip's duration
    let mut shift_count = 0;
    for clip in &mut track.clips {
        if clip.timeline_in >= deleted_clip_in {
            clip.timeline_in -= deleted_clip_duration;
            clip.timeline_out -= deleted_clip_duration;
            shift_count += 1;
        }
    }

    track.validate_and_sort_clips();

    let receipt = serde_json::json!({
        "status": "success",
        "tool": "ripple_delete_clip",
        "receipt": {
            "deleted_clip_id": clip_id,
            "track_id": track.id,
            "clips_shifted": shift_count,
            "shift_duration_frames": deleted_clip_duration
        }
    });
    Ok(receipt.to_string())
}

pub fn update_adjustments(
    args: &Value,
    timeline_state: &mut TimelineState,
) -> Result<String, String> {
    let clip_id = args["clip_id"]
        .as_str()
        .ok_or_else(|| "Missing 'clip_id' argument".to_string())?;

    let mut found = false;
    let mut updated_adj = None;

    for track in &mut timeline_state.tracks {
        if let Some(clip) = track.clips.iter_mut().find(|c| c.id == clip_id) {
            let mut current = match clip.adjustments.take() {
                Some(v) => v,
                None => Adjustments::default(),
            };

            if let Some(val) = args.get("brightness").and_then(|v| v.as_f64()) {
                current.brightness = val as f32;
            }
            if let Some(val) = args.get("contrast").and_then(|v| v.as_f64()) {
                current.contrast = val as f32;
            }
            if let Some(val) = args.get("saturation").and_then(|v| v.as_f64()) {
                current.saturation = val as f32;
            }
            if let Some(val) = args.get("vignette").and_then(|v| v.as_f64()) {
                current.vignette = val as f32;
            }
            if let Some(val) = args.get("sepia").and_then(|v| v.as_f64()) {
                current.sepia = val as f32;
            }
            if let Some(val) = args.get("temperature").and_then(|v| v.as_f64()) {
                current.temperature = val as f32;
            }
            if let Some(val) = args.get("preset") {
                current.preset = val.as_str().map(|s| s.to_string());
            }
            if let Some(val) = args.get("tint").and_then(|v| v.as_array()) {
                let tint_vals: Vec<f32> = val
                    .iter()
                    .map(|v| v.as_f64().unwrap_or(1.0) as f32)
                    .collect();
                current.tint = Some(tint_vals);
            }

            updated_adj = Some(current.clone());
            clip.adjustments = Some(current);
            track.validate_and_sort_clips();
            found = true;
            break;
        }
    }

    if found {
        let receipt = serde_json::json!({
            "status": "success",
            "tool": "update_adjustments",
            "receipt": {
                "clip_id": clip_id,
                "adjustments": updated_adj
            }
        });
        Ok(receipt.to_string())
    } else {
        Err(format!("Clip '{}' not found in any track.", clip_id))
    }
}
