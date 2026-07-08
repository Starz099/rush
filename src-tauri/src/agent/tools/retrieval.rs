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

pub async fn search_storyboard_embeddings(
    args: &Value,
    app: &tauri::AppHandle,
) -> Result<String, String> {
    use crate::state::AppState;
    use tauri::Manager;

    let asset_id = args["asset_id"]
        .as_str()
        .ok_or("Missing 'asset_id' argument".to_string())?;
    let query_text = args["query_text"]
        .as_str()
        .ok_or("Missing 'query_text' argument".to_string())?;
    let limit = args["limit"].as_i64().unwrap_or(5) as i32;

    println!(
        "[search] Querying semantic frames for asset={} with text='{}' (limit={})",
        asset_id, query_text, limit
    );

    // Retrieve app data directory to locate the models
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))?;

    let query_vector =
        crate::agent::ai::embeddings::get_text_embedding(query_text, &app_data_dir).await?;

    let mut query_blob = Vec::with_capacity(512 * 4);
    for &val in &query_vector {
        query_blob.extend_from_slice(&val.to_le_bytes());
    }

    let db_state = app.state::<AppState>();
    let db = db_state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT
                s.timestamp_ms,
                s.description,
                vec_distance_cosine(e.embedding, ?1) as distance
            FROM asset_embeddings e
            JOIN asset_storyboards s ON e.storyboard_id = s.id
            WHERE s.asset_id = ?2
            ORDER BY distance ASC
            LIMIT ?3",
        )
        .map_err(|e| format!("Failed to prepare SQL search statement: {}", e))?;

    let matches = stmt
        .query_map((&query_blob, asset_id, limit), |row| {
            let timestamp_ms: i64 = row.get(0)?;
            let description: Option<String> = row.get(1)?;
            let distance: f64 = row.get(2)?;
            Ok((timestamp_ms, description, distance))
        })
        .map_err(|e| format!("Semantic search query failed: {}", e))?;

    let mut result_summary = String::from(
        "Semantic Search Matches (Lower distance means higher
  similarity):\n",
    );

    let mut count = 0;

    for row in matches {
        if let Ok((timestamp_ms, description, distance)) = row {
            count += 1;

            let similarity_score = (1.0 - distance / 2.0) * 100.0; // Convert cosine distance to percentage similarity

            let desc_str = description.unwrap_or_else(|| "No description available".to_string());

            result_summary.push_str(&format!(
                "- Match #{}: Time: {}ms ({:.2}s) | Similarity: {:.1}% | Description: {}\n",
                count,
                timestamp_ms,
                (timestamp_ms as f32 / 1000.0),
                similarity_score,
                desc_str
            ));
        }
    }
    if count == 0 {
        return Ok("No relevant visual matches were found in this asset.".to_string());
    }

    Ok(result_summary)
}
