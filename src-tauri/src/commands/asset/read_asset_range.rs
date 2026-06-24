use crate::models::RangeResult;

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
