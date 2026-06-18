use crate::db::models::asset::Asset;
use crate::models::RangeResult;
use crate::state::AppState;
use std::path::Path;
use tauri::Manager;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub fn register_asset(
    state: State<'_, AppState>,
    project_id: String,
    file_path: String,
    duration_ms: Option<i32>,
) -> Result<Asset, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist on disk".into());
    }

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown File")
        .to_string();

    let file_name_lower = file_name.to_lowercase();
    let media_type = if file_name_lower.ends_with(".mp4")
        || file_name_lower.ends_with(".mkv")
        || file_name_lower.ends_with(".mov")
    {
        "video"
    } else if file_name_lower.ends_with(".png")
        || file_name_lower.ends_with(".jpg")
        || file_name_lower.ends_with(".jpeg")
        || file_name_lower.ends_with(".webp")
        || file_name_lower.ends_with(".gif")
    {
        "image"
    } else if file_name_lower.ends_with(".mp3")
        || file_name_lower.ends_with(".wav")
        || file_name_lower.ends_with(".aac")
        || file_name_lower.ends_with(".m4a")
    {
        "audio"
    } else {
        "unknown"
    }
    .to_string();

    let id = Uuid::new_v4().to_string();
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO assets (id, project_id, name, file_path, media_type, duration_ms) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (
            &id,
            &project_id,
            &file_name,
            &file_path,
            &media_type,
            &duration_ms,
        ),
    )
    .map_err(|e| e.to_string())?;

    let new_asset = db.query_row(
        "SELECT id, project_id, name, file_path, media_type, thumbnail_path, duration_ms, created_at 
         FROM assets WHERE id = ?1",
        [&id],
        Asset::from_row,
    ).map_err(|e| e.to_string())?;

    Ok(new_asset)
}

#[tauri::command]
#[specta::specta]
pub fn get_assets(state: State<'_, AppState>, project_id: String) -> Result<Vec<Asset>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT id, project_id, name, file_path, media_type, thumbnail_path, duration_ms, created_at 
             FROM assets WHERE project_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let asset_iter = stmt
        .query_map([&project_id], Asset::from_row)
        .map_err(|e| e.to_string())?;

    let mut assets = Vec::new();
    for asset in asset_iter {
        assets.push(asset.map_err(|e| e.to_string())?);
    }

    Ok(assets)
}

#[tauri::command]
#[specta::specta]
pub fn delete_asset(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute("DELETE FROM assets WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    println!("Deleted asset with id: {}", id);

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn rename_asset(
    state: State<'_, AppState>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE assets SET name = ?1 WHERE id = ?2",
        (&new_name, &id),
    )
    .map_err(|e| e.to_string())?;

    println!("Renamed asset with id: {}", id);

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn read_asset_bytes(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| e.to_string())
}

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
    let status = std::process::Command::new("ffmpeg")
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

#[tauri::command]
#[specta::specta]
pub fn read_asset_range(
    file_path: String,
    offset: f64,
    length: u32,
) -> Result<RangeResult, String> {
    use std::fs::File;
    use std::io::{Read, Seek, SeekFrom};

    let mut file = File::open(&file_path).map_err(|e| e.to_string())?;
    let file_len = file.metadata().map_err(|e| e.to_string())?.len();

    let offset_i64 = offset as i64;

    let start_pos = if offset_i64 < 0 {
        let neg_offset = (-offset_i64) as u64;
        if file_len > neg_offset {
            file_len - neg_offset
        } else {
            0
        }
    } else {
        let pos_offset = offset_i64 as u64;
        if pos_offset < file_len {
            pos_offset
        } else {
            file_len
        }
    };

    file.seek(SeekFrom::Start(start_pos))
        .map_err(|e| e.to_string())?;

    let mut buffer = vec![0u8; length as usize];
    let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
    buffer.truncate(bytes_read);

    Ok(RangeResult {
        bytes: buffer,
        file_start: start_pos as f64,
        total_length: file_len as f64,
    })
}

#[tauri::command]
#[specta::specta]
pub fn read_moov_box(file_path: String) -> Result<RangeResult, String> {
    use std::fs::File;
    use std::io::{Read, Seek, SeekFrom};

    let mut file = File::open(&file_path).map_err(|e| e.to_string())?;
    let file_len = file.metadata().map_err(|e| e.to_string())?.len();

    let mut current_offset: u64 = 0;
    let mut moov_offset: Option<u64> = None;
    let mut moov_size: Option<u64> = None;

    loop {
        if current_offset >= file_len {
            break;
        }

        file.seek(SeekFrom::Start(current_offset))
            .map_err(|e| e.to_string())?;

        let mut header = [0u8; 8];
        let bytes_read = file.read(&mut header).map_err(|e| e.to_string())?;
        if bytes_read < 8 {
            break;
        }

        let mut size = u32::from_be_bytes([header[0], header[1], header[2], header[3]]) as u64;
        let box_type = &header[4..8];

        if size == 1 {
            let mut ext_size = [0u8; 8];
            file.read_exact(&mut ext_size).map_err(|e| e.to_string())?;
            size = u64::from_be_bytes(ext_size);
        }

        if box_type == b"moov" {
            let actual_size = if size == 0 {
                file_len - current_offset
            } else {
                size
            };
            moov_offset = Some(current_offset);
            moov_size = Some(actual_size);
            break;
        }

        if size == 0 {
            break;
        }

        current_offset += size;
    }

    let offset = moov_offset.ok_or_else(|| "moov box not found in file".to_string())?;
    let size = moov_size.ok_or_else(|| "moov box not found in file".to_string())?;

    file.seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; size as usize];
    file.read_exact(&mut buffer).map_err(|e| e.to_string())?;

    Ok(RangeResult {
        bytes: buffer,
        file_start: offset as f64,
        total_length: file_len as f64,
    })
}
