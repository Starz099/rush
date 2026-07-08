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

/// Checks if the local CLIP vision model is present.
/// If not, downloads it from Hugging Face and saves it to the app data directory.
pub async fn ensure_clip_model(app_data_dir: &Path) -> Result<PathBuf, String> {
    let models_dir = app_data_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    let model_path = models_dir.join("clip_vision_quantized.onnx");
    if model_path.exists() {
        return Ok(model_path);
    }

    println!("CLIP vision model not found locally. Downloading from Hugging Face...");
    let url = "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model_quantized.onnx";

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to send download request for CLIP model: {}", e))?;

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

    println!(
        "CLIP vision model downloaded successfully to: {:?}",
        model_path
    );
    Ok(model_path)
}

/// Checks if the local CLIP text model is present.
/// If not, downloads it from Hugging Face and saves it to the app data directory.
pub async fn ensure_clip_text_model(app_data_dir: &Path) -> Result<PathBuf, String> {
    let models_dir = app_data_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    let model_path = models_dir.join("clip_text_quantized.onnx");
    if model_path.exists() {
        return Ok(model_path);
    }

    println!("CLIP text model not found locally. Downloading from Hugging Face...");
    let url = "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/text_model_quantized.onnx";

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to send download request for CLIP text model: {}", e))?;

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

    println!(
        "CLIP text model downloaded successfully to: {:?}",
        model_path
    );
    Ok(model_path)
}
