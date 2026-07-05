use rusqlite::Connection;
use std::fs;
use std::path::Path;
use tauri::Manager;
use uuid::Uuid;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Uses FFmpeg to extract a standardized 16kHz, mono, 16-bit PCM WAV file
pub fn extract_wav_for_whisper(input_path: &str, output_path: &str) -> Result<(), String> {
    let mut cmd = crate::commands::process_helper::create_ffmpeg_command();

    let status = cmd
        .args(&[
            "-y",
            "-i",
            input_path,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            output_path,
        ])
        .status()
        .map_err(|e| format!("FFmpeg failed to start: {}", e))?;

    if !status.success() {
        return Err("FFmpeg WAV extraction exited with an error status".into());
    }

    Ok(())
}

/// Transcribes WAV audio using whisper-rs (v0.16.0) and saves segments/words as JSON in SQLite
pub fn transcribe_audio(
    model_path: &Path,
    wav_path: &Path,
    asset_id: &str,
    db_path: &Path,
) -> Result<(), String> {
    // 1. Read WAV file using hound
    let mut reader =
        hound::WavReader::open(wav_path).map_err(|e| format!("Failed to open WAV file: {}", e))?;
    let spec = reader.spec();

    if spec.channels != 1 || spec.sample_rate != 16000 || spec.bits_per_sample != 16 {
        return Err("WAV audio must be 16kHz, mono, 16-bit PCM".into());
    }

    let samples: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| {
            let sample = s.unwrap_or(0);
            sample as f32 / 32768.0
        })
        .collect();

    // 2. Load Whisper context
    let ctx = WhisperContext::new_with_params(
        model_path.to_str().ok_or("Invalid model path")?,
        WhisperContextParameters::default(),
    )
    .map_err(|e| format!("Failed to create Whisper context: {:?}", e))?;

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("Failed to create Whisper state: {:?}", e))?;

    // 3. Set up transcription parameters
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_token_timestamps(true); // Extract word-level timestamps
    params.set_translate(true);
    params.set_language(Some("en"));

    // 4. Run inference
    state
        .full(params, &samples)
        .map_err(|e| format!("Failed to run Whisper transcription: {:?}", e))?;

    // 5. Open SQLite database connection
    let mut db =
        Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Enable foreign keys
    let _ = db.execute("PRAGMA foreign_keys = ON;", []);

    let tx = db
        .transaction()
        .map_err(|e| format!("Failed to start database transaction: {}", e))?;

    // 6. Iterate through segments using modern whisper-rs iterator API
    for segment in state.as_iter() {
        let segment_text = segment.to_str().unwrap_or_default();

        let start_ms = segment.start_timestamp() * 10;
        let end_ms = segment.end_timestamp() * 10;

        let num_tokens = segment.n_tokens();
        let mut words = Vec::new();

        for j in 0..num_tokens {
            if let Some(token) = segment.get_token(j) {
                let token_text = token.to_str().unwrap_or_default();

                // Clean up special/control tokens
                if token_text.starts_with("[") && token_text.ends_with("]") {
                    continue;
                }

                let token_data = token.token_data();
                let word_start = token_data.t0 * 10;
                let word_end = token_data.t1 * 10;

                let cleaned_word = token_text.trim().to_string();
                if cleaned_word.is_empty() {
                    continue;
                }

                words.push(serde_json::json!({
                    "word": cleaned_word,
                    "startMs": word_start,
                    "endMs": word_end
                }));
            }
        }

        // Serialize both the text and the words array into the `text` field as a JSON string
        let serialized_content = serde_json::json!({
            "text": segment_text.trim(),
            "words": words
        })
        .to_string();

        let id = Uuid::new_v4().to_string();

        tx.execute(
            "INSERT INTO asset_transcripts (id, asset_id, start_ms, end_ms, text, speaker_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (
                &id,
                asset_id,
                &start_ms,
                &end_ms,
                &serialized_content,
                &None::<String>,
            ),
        )
        .map_err(|e| format!("Failed to insert transcript row: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transcript transaction: {}", e))?;

    Ok(())
}

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

    // Only run speech-to-text for audio or video files
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
        extract_wav_for_whisper(&file_path, temp_wav_str)?;

        // 4. Transcribe WAV file and insert into DB
        println!("Running Whisper speech-to-text...");
        let transcribe_res = transcribe_audio(&model_path, &temp_wav_path, &asset_id, &db_path);

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

    Ok(())
}
