#[tauri::command]
#[specta::specta]
pub fn slice_audio_asset(
    file_path: String,
    start_sec: f64,
    duration_sec: f64,
) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("Source audio file does not exist".into());
    }

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    ((start_sec * 1000.0) as i64).hash(&mut hasher);
    ((duration_sec * 1000.0) as i64).hash(&mut hasher);
    let hash_val = hasher.finish();
    let slice_filename = format!("slice_{:x}.mp3", hash_val);

    let temp_dir = std::env::temp_dir();
    let slice_dir = temp_dir.join("rush_slices");
    if !slice_dir.exists() {
        std::fs::create_dir_all(&slice_dir)
            .map_err(|e| format!("Failed to create slice dir: {}", e))?;
    }

    let slice_path = slice_dir.join(slice_filename);
    let slice_path_str = slice_path
        .to_str()
        .ok_or("Failed to convert slice path to string")?
        .to_string();

    if slice_path.exists() {
        println!("[Backend] Audio slice cache hit: {}", slice_path_str);
        return Ok(slice_path_str);
    }

    println!(
        "[Backend] Slicing audio track from {} [start={:.2}s, dur={:.2}s] to {} using FFmpeg...",
        file_path, start_sec, duration_sec, slice_path_str
    );

    let start_str = start_sec.to_string();
    let duration_str = duration_sec.to_string();

    let status = crate::commands::process_helper::create_ffmpeg_command()
        .args(&[
            "-y",
            "-ss",
            &start_str,
            "-t",
            &duration_str,
            "-i",
            &file_path,
            "-vn",
            "-acodec",
            "libmp3lame",
            "-q:a",
            "4",
            &slice_path_str,
        ])
        .status()
        .map_err(|e| format!("Failed to start FFmpeg for audio slicing: {}", e))?;

    if !status.success() {
        return Err("FFmpeg audio slicing failed".into());
    }

    println!(
        "[Backend] Audio slice generated successfully: {}",
        slice_path_str
    );
    Ok(slice_path_str)
}
