#[tauri::command]
#[specta::specta]
pub fn read_asset_bytes(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| e.to_string())
}
