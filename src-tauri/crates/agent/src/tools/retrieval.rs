use crate::context::asset::format_assets;
use crate::context::timeline::format_timeline;
use rush_db::models::asset::Asset;
use rush_db::models::clip::TimelineState;
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
    use rush_db::AppState;
    use tauri::Manager;

    let start_frame = args["start_frame"].as_i64().ok_or("Missing start_frame")? as i32;
    let end_frame = args["end_frame"].as_i64().ok_or("Missing end_frame")? as i32;

    let db_state = app.state::<AppState>();
    let db = db_state.db.lock().map_err(|e| e.to_string())?;

    let composed = rush_asset_processor::composer::audio::compose_transcript(
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

    let base64_image = crate::inspect_timeline_service(
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
        rush_asset_processor::embeddings::get_text_embedding(app, query_text, &app_data_dir).await?;

    let mut query_blob = Vec::with_capacity(512 * 4);
    for &val in &query_vector {
        query_blob.extend_from_slice(&val.to_le_bytes());
    }

    let db_state = app.state::<rush_db::AppState>();
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

#[derive(serde::Deserialize)]
struct DbTranscriptContent {
    text: String,
    #[serde(default)]
    words: Vec<DbWord>,
}

#[derive(serde::Deserialize, Clone)]
struct DbWord {
    word: String,
    #[serde(rename = "startMs")]
    start_ms: i32,
    #[serde(rename = "endMs")]
    end_ms: i32,
}

pub fn search_assets_transcripts(
    args: &Value,
    app: &tauri::AppHandle,
    project_id: &str,
) -> Result<String, String> {
    use rush_db::AppState;
    use tauri::Manager;

    let query_text = args["query_text"]
        .as_str()
        .ok_or_else(|| "Missing 'query_text' argument".to_string())?
        .to_lowercase();

    let limit = args["limit"].as_i64().unwrap_or(10) as usize;

    let db_state = app.state::<AppState>();
    let db = db_state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT t.asset_id, a.name, t.text
             FROM asset_transcripts t
             JOIN assets a ON t.asset_id = a.id
             WHERE a.project_id = ?1 AND t.text LIKE ?2",
        )
        .map_err(|e| format!("Failed to prepare transcript search query: {}", e))?;

    let sql_like_query = format!("%{}%", query_text);
    let rows = stmt
        .query_map((project_id, &sql_like_query), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query transcripts: {}", e))?;

    let mut result_summary = format!("Search Results for spoken text: '{}'\n", query_text);
    let mut count = 0;

    for row in rows {
        if count >= limit {
            break;
        }

        let (asset_id, asset_name, json_str) =
            row.map_err(|e| format!("Failed to read transcript row: {}", e))?;

        if let Ok(content) = serde_json::from_str::<DbTranscriptContent>(&json_str) {
            // Find specific matching word sequences or timestamps
            if content.text.to_lowercase().contains(&query_text) {
                // Find approximate word timestamps
                let mut start_ms = 0;
                let mut end_ms = 0;
                if !content.words.is_empty() {
                    start_ms = content.words.first().unwrap().start_ms;
                    end_ms = content.words.last().unwrap().end_ms;
                }

                count += 1;
                result_summary.push_str(&format!(
                    "- Match #{}: Asset: '{}' (ID: '{}')\n  Time range: {:.2}s - {:.2}s ({}ms - {}ms)\n  Spoken segment: \"{}\"\n\n",
                    count,
                    asset_name,
                    asset_id,
                    start_ms as f32 / 1000.0,
                    end_ms as f32 / 1000.0,
                    start_ms,
                    end_ms,
                    content.text
                ));
            }
        }
    }

    if count == 0 {
        return Ok(format!("No matching spoken text was found for '{}' in any project asset transcripts.", query_text));
    }

    Ok(result_summary)
}

pub fn get_asset_transcript(args: &Value, app: &tauri::AppHandle) -> Result<String, String> {
    use rush_db::AppState;
    use tauri::Manager;

    let asset_id = args["asset_id"]
        .as_str()
        .ok_or_else(|| "Missing 'asset_id' argument".to_string())?;

    let db_state = app.state::<AppState>();
    let db = db_state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare("SELECT text FROM asset_transcripts WHERE asset_id = ?1 ORDER BY start_ms ASC")
        .map_err(|e| format!("Failed to prepare asset transcript query: {}", e))?;

    let rows = stmt
        .query_map([asset_id], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query asset transcript: {}", e))?;

    let mut all_segments = Vec::new();

    for row in rows {
        let json_str = row.map_err(|e| format!("Failed to read transcript row: {}", e))?;
        if let Ok(content) = serde_json::from_str::<DbTranscriptContent>(&json_str) {
            let mut start_ms = 0;
            let mut end_ms = 0;
            if !content.words.is_empty() {
                start_ms = content.words.first().unwrap().start_ms;
                end_ms = content.words.last().unwrap().end_ms;
            }

            let start_sec = start_ms as f32 / 1000.0;
            let end_sec = end_ms as f32 / 1000.0;
            all_segments.push(format!(
                "[{:02.1}s - {:02.1}s]: \"{}\"",
                start_sec, end_sec, content.text
            ));
        }
    }

    if all_segments.is_empty() {
        return Ok("This asset has no spoken transcription segments recorded.".to_string());
    }

    let mut output = format!("Spoken Transcript for Asset ID '{}':\n", asset_id);
    output.push_str(&all_segments.join("\n"));
    Ok(output)
}
