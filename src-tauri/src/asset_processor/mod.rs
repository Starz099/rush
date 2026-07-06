pub mod audio;
pub mod video;

use rusqlite::Connection;
use std::fs;
use tauri::Manager;

/// Core background preprocessor task triggered on media asset import
pub async fn preprocess_asset_in_background(
    app_handle: tauri::AppHandle,
    asset_id: String,
    file_path: String,
    media_type: String,
    duration_ms: Option<i32>,
) -> Result<(), String> {
    println!(
        "Starting background preprocessing for asset: {} ({})",
        asset_id, media_type
    );

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))?;

    let db_path = app_data_dir.join("workspace.db");

    // Initialize default asset metadata row
    {
        let db = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open DB for metadata initialization: {}", e))?;
        db.execute(
            "INSERT OR IGNORE INTO asset_metadata (asset_id, bpm, duration_ms, primary_type, mood_tags)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &asset_id,
                &0.0,
                &duration_ms.unwrap_or(0),
                &media_type,
                &None::<String>,
            ),
        )
        .map_err(|e| format!("Failed to insert default asset metadata: {}", e))?;
    }

    // Run audio pipeline (speech-to-text / transcripts) for video or audio files
    if media_type == "video" || media_type == "audio" {
        // 1. Ensure Whisper model is downloaded
        let model_path = crate::agent::ai::models::ensure_whisper_model(&app_data_dir).await?;

        // 2. Setup temp path for wav extraction
        let cache_dir = app_data_dir.join("extracted_audio");
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir)
                .map_err(|e| format!("Failed to create audio cache directory: {}", e))?;
        }

        let temp_wav_path = cache_dir.join(format!("{}.wav", asset_id));
        let temp_wav_str = temp_wav_path
            .to_str()
            .ok_or("Failed to convert temp WAV path to string")?;

        // 3. Extract audio as WAV
        println!("Extracting WAV file for Whisper...");
        audio::extract_wav_for_whisper(&file_path, temp_wav_str)?;

        // 4. Transcribe WAV file and insert into DB
        println!("Running Whisper speech-to-text...");
        let transcribe_res =
            audio::transcribe_audio(&model_path, &temp_wav_path, &asset_id, &db_path);

        // 5. Clean up temp WAV file
        if temp_wav_path.exists() {
            let _ = fs::remove_file(&temp_wav_path);
        }

        transcribe_res?;
        println!(
            "Background speech indexing finished successfully for asset: {}",
            asset_id
        );
    }

    // Run visual pipeline (LumaGrid / keyframes) for video files
    if media_type == "video" {
        println!("Running LumaGrid visual cut sampler...");
        video::extract_visual_storyboard(&file_path, &asset_id, &db_path)?;
        println!(
            "Background visual indexing finished successfully for asset: {}",
            asset_id
        );
    }

    Ok(())
}
