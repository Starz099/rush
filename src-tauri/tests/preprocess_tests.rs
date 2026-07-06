use app_lib::agent::ai::models::ensure_whisper_model;
use app_lib::asset_processor::audio::{extract_wav_for_whisper, transcribe_audio};
use std::path::Path;

#[tokio::test]
async fn test_run_preprocess_manually() {
    let app_data_dir = Path::new(r"C:\Users\Mayank\AppData\Roaming\com.rush.dev");
    let db_path = app_data_dir.join("workspace.db");
    let input_path = r"C:\Users\Mayank\Downloads\testing-transcription.mp4";
    let asset_id = "37452ab8-2160-481f-98bf-0c8ba4ca3ee6"; // Dummy ID for test

    if !Path::new(input_path).exists() {
        println!("Test media file does not exist at: {}", input_path);
        return;
    }

    // 1. Initialize database to create all tables
    let conn = app_lib::db::initialize_database(&app_data_dir);

    // 2. Seed mock project, asset, and metadata rows
    conn.execute(
        "INSERT OR IGNORE INTO projects (id, name) VALUES ('test-project-id', 'Test Project')",
        [],
    )
    .unwrap();

    conn.execute(
        "INSERT OR IGNORE INTO assets (id, project_id, name, file_path, media_type)
             VALUES (?1, 'test-project-id', 'Oto Demo', ?2, 'video')",
        [asset_id, input_path],
    )
    .unwrap();

    conn.execute(
        "INSERT OR IGNORE INTO asset_metadata (asset_id, bpm, duration_ms, primary_type)
             VALUES (?1, 0.0, 20000, 'video')",
        [asset_id],
    )
    .unwrap();

    // 3. Ensure Whisper model is downloaded
    let model_path = ensure_whisper_model(&app_data_dir).await.unwrap();
    println!("Using model path: {:?}", model_path);

    // 4. Setup temp path for wav extraction
    let cache_dir = app_data_dir.join("extracted_audio");
    std::fs::create_dir_all(&cache_dir).unwrap();
    let temp_wav_path = cache_dir.join("test_temp.wav");
    let temp_wav_str = temp_wav_path.to_str().unwrap();

    // 5. Extract audio
    println!("Extracting WAV file...");
    extract_wav_for_whisper(input_path, temp_wav_str).unwrap();

    // 6. Transcribe WAV file and insert into DB (computes RMS & beats)
    println!("Running Whisper speech-to-text...");
    transcribe_audio(&model_path, &temp_wav_path, asset_id, &db_path).unwrap();

    // 7. Clean up temp WAV
    if temp_wav_path.exists() {
        let _ = std::fs::remove_file(&temp_wav_path);
    }

    println!("Transcribed successfully! Reading back from database...");

    // Print what is stored in asset_transcripts for this asset!
    let mut stmt = conn
        .prepare("SELECT start_ms, end_ms, text FROM asset_transcripts WHERE asset_id = ?")
        .unwrap();
    let transcripts = stmt
        .query_map([asset_id], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, i32>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .unwrap();

    for t in transcripts {
        let (start, end, text) = t.unwrap();
        println!("[{}ms - {}ms]: {}", start, end, text);
    }

    // Print what is stored in asset_metadata for this asset!
    let mut stmt = conn
                .prepare("SELECT bpm, duration_ms, amplitude_envelope, beats FROM asset_metadata WHERE asset_id = ?")
                .unwrap();
    let metadata = stmt
        .query_row([asset_id], |row| {
            Ok((
                row.get::<_, f64>(0)?,
                row.get::<_, i32>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })
        .unwrap();

    let (bpm, duration, envelope, beats) = metadata;
    println!("=== AUDIO DSP METADATA ===");
    println!("BPM: {}", bpm);
    println!("Duration: {} ms", duration);
    println!(
        "Loudness envelope length (100ms bins): {}",
        envelope.as_ref().map(|s| s.len()).unwrap_or(0)
    );
    if let Some(ref env_str) = envelope {
        let preview: String = env_str.chars().take(80).collect();
        println!("Loudness preview (100ms bins): {}...", preview);
    }
    if let Some(ref beats_str) = beats {
        println!("Detected beats (seconds): {}", beats_str);
    }
}
