use rush_db::models::presets::RangeResult;

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
