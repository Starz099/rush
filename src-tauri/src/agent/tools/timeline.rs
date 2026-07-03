use crate::db::models::asset::Asset;
use crate::db::models::clip::{Clip, TimelineState, Track, Transform};
use crate::models::TrackType;
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

    let clip = Clip {
        id: Uuid::new_v4().to_string(),
        asset_id: Some(asset_id.to_string()),
        timeline_in,
        timeline_out: timeline_in + duration_frames,
        source_in: 0,
        source_out: duration_frames,
        transform: Some(Transform {
            x: 0.0,
            y: 0.0,
            scale: 1.0,
            z_index: 0,
        }),
        speed_factor: 1.0,
        effects: vec![],
    };

    track.clips.push(clip.clone());
    track.validate_and_sort_clips();

    Ok(format!(
        "Successfully added clip '{}' (Asset: '{}') to track '{}' at frame {} with duration {} frames.",
        clip.id, asset.name, track.name, timeline_in, duration_frames
    ))
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
        Ok(format!(
            "Successfully deleted clip '{}' from timeline.",
            clip_id
        ))
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

    let mut found = false;
    for track in &mut timeline_state.tracks {
        if let Some(pos) = track.clips.iter().position(|c| c.id == clip_id) {
            let mut clip = track.clips.remove(pos);
            let duration = clip.timeline_out - clip.timeline_in;
            clip.timeline_in = new_timeline_in;
            clip.timeline_out = new_timeline_in + duration;
            track.clips.push(clip);
            track.validate_and_sort_clips();
            found = true;
            break;
        }
    }

    if found {
        Ok(format!(
            "Successfully moved clip '{}' to timeline frame position {}.",
            clip_id, new_timeline_in
        ))
    } else {
        Err(format!("Clip '{}' not found in any track.", clip_id))
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

    let mut found = false;
    for track in &mut timeline_state.tracks {
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
            track.validate_and_sort_clips();
            found = true;
            break;
        }
    }

    if found {
        Ok(format!("Successfully trimmed clip '{}'.", clip_id))
    } else {
        Err(format!("Clip '{}' not found in any track.", clip_id))
    }
}
