use std::path::Path;
use tauri::Manager;

#[tauri::command]
#[specta::specta]
pub fn extract_audio(app_handle: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("Source file does not exist".into());
    }

    // Hash the file path to create a unique filename in our temporary cache
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    let hash_val = hasher.finish();
    let cache_filename = format!("audio_{:x}.mp3", hash_val);

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let cache_dir = app_data_dir.join("extracted_audio");
    if !cache_dir.exists() {
        std::fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("Failed to create cache dir: {}", e))?;
    }

    let cache_path = cache_dir.join(cache_filename);
    let cache_path_str = cache_path
        .to_str()
        .ok_or("Failed to convert cache path to string")?
        .to_string();

    if cache_path.exists() {
        println!("Audio cache hit: {}", cache_path_str);
        return Ok(cache_path_str);
    }

    println!(
        "Extracting audio track from {} to {} using FFmpeg...",
        file_path, cache_path_str
    );

    // Spawn ffmpeg command to extract audio: ffmpeg -y -i input -vn -acodec libmp3lame -q:a 4 output
    let status = crate::commands::process_helper::create_ffmpeg_command()
        .args(&[
            "-y",
            "-i",
            &file_path,
            "-vn",
            "-acodec",
            "libmp3lame",
            "-q:a",
            "4",
            &cache_path_str,
        ])
        .status()
        .map_err(|e| format!("Failed to start FFmpeg for audio extraction: {}", e))?;

    if !status.success() {
        return Err("FFmpeg audio extraction failed".into());
    }

    println!("Successfully extracted audio to: {}", cache_path_str);
    Ok(cache_path_str)
}
