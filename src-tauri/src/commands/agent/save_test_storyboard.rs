use base64::Engine;

#[tauri::command]
#[specta::specta]
pub fn save_test_storyboard(storyboard_base64: String) -> Result<(), String> {
    let output_dir = "C:\\Users\\Mayank\\Desktop\\rush\\storyboard_test_output";
    std::fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;

    let decoded_bytes = base64::engine::general_purpose::STANDARD
        .decode(&storyboard_base64)
        .map_err(|e| format!("Failed to decode storyboard base64: {}", e))?;

    let save_path = format!("{}/live_storyboard.jpg", output_dir);
    std::fs::write(&save_path, decoded_bytes)
        .map_err(|e| format!("Failed to write live storyboard file: {}", e))?;

    println!(
        "Live timeline storyboard successfully saved to: {}",
        save_path
    );
    Ok(())
}
