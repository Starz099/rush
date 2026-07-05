use app_lib::agent::ai::models::ensure_whisper_model;
use app_lib::commands::asset::preprocess::{extract_wav_for_whisper, transcribe_audio};
use rusqlite::Connection;
use std::path::Path;

#[tokio::test]
async fn test_run_preprocess_manually() {
    let app_data_dir = Path::new(r"C:\Users\Mayank\AppData\Roaming\com.rush.dev");
    let db_path = app_data_dir.join("workspace.db");
    let input_path = r"C:\Users\Mayank\Videos\oto_demo.mp4";
    let asset_id = "37452ab8-2160-481f-98bf-0c8ba4ca3ee6"; // Existing asset ID in database

    if !Path::new(input_path).exists() {
        println!("Test media file does not exist at: {}", input_path);
        return;
    }

    // 1. Ensure Whisper model is downloaded
    let model_path = ensure_whisper_model(&app_data_dir).await.unwrap();
    println!("Using model path: {:?}", model_path);

    // 2. Setup temp path for wav extraction
    let cache_dir = app_data_dir.join("extracted_audio");
    std::fs::create_dir_all(&cache_dir).unwrap();
    let temp_wav_path = cache_dir.join("test_temp.wav");
    let temp_wav_str = temp_wav_path.to_str().unwrap();

    // 3. Extract audio
    println!("Extracting WAV file...");
    extract_wav_for_whisper(input_path, temp_wav_str).unwrap();

    // 4. Transcribe WAV file and insert into DB
    println!("Running Whisper speech-to-text...");
    transcribe_audio(&model_path, &temp_wav_path, asset_id, &db_path).unwrap();

    // 5. Clean up temp WAV
    if temp_wav_path.exists() {
        let _ = std::fs::remove_file(&temp_wav_path);
    }

    println!("Transcribed successfully! Reading back from database...");

    // Print what is stored in asset_transcripts for this asset!
    let conn = Connection::open(&db_path).unwrap();
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
}
