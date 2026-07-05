use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

/// Checks if the local Whisper ggml-tiny model is present.
/// If not, downloads it from Hugging Face and saves it to the app data directory.
pub async fn ensure_whisper_model(app_data_dir: &Path) -> Result<PathBuf, String> {
    let models_dir = app_data_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    let model_path = models_dir.join("ggml-base.bin");
    if model_path.exists() {
        return Ok(model_path);
    }

    println!("Whisper model not found locally. Downloading from Hugging Face...");
    let url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to send download request for Whisper model: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "HuggingFace returned error status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to download model file chunk: {}", e))?;

    let mut file = File::create(&model_path)
        .map_err(|e| format!("Failed to create model file on disk: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write model file: {}", e))?;

    println!("Whisper model downloaded successfully to: {:?}", model_path);
    Ok(model_path)
}
