use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Emitter;

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AssetProcessPayload {
    pub asset_id: Option<String>,
    pub task_type: String, // "download_whisper", "download_clip_vision", "download_clip_text", "transcribe_audio", "visual_indexing"
    pub progress: f32,     // 0.0 to 100.0
    pub status: String,    // "started", "progressing", "completed", "error"
    pub message: String,
}

/// Helper function to perform a streaming download with progress updates emitted to the Tauri frontend.
async fn download_file_with_progress(
    app: &tauri::AppHandle,
    url: &str,
    dest_path: &Path,
    task_type: &str,
    display_name: &str,
) -> Result<(), String> {
    println!(
        "Starting streaming download of {} from {}",
        display_name, url
    );

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut response = client.get(url).send().await.map_err(|e| {
        format!(
            "Failed to send download request for {}: {}",
            display_name, e
        )
    })?;

    if !response.status().is_success() {
        return Err(format!(
            "Server returned error status {} for {}",
            response.status(),
            display_name
        ));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut file = File::create(dest_path)
        .map_err(|e| format!("Failed to create destination file on disk: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();

    // Emit starting status
    let _ = app.emit(
        "asset_process_status",
        AssetProcessPayload {
            asset_id: None,
            task_type: task_type.to_string(),
            progress: 0.0,
            status: "started".to_string(),
            message: format!("Downloading {}...", display_name),
        },
    );

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Error during streaming chunk: {}", e))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk to disk: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let progress = (downloaded as f32 / total_size as f32) * 100.0;
            // Emit progress updates at most every 150ms to avoid flooding the Tauri IPC bridge
            if last_emit.elapsed() > std::time::Duration::from_millis(150)
                || downloaded == total_size
            {
                let _ = app.emit(
                    "asset_process_status",
                    AssetProcessPayload {
                        asset_id: None,
                        task_type: task_type.to_string(),
                        progress,
                        status: "progressing".to_string(),
                        message: format!("Downloading {}: {:.1}%", display_name, progress),
                    },
                );
                last_emit = std::time::Instant::now();
            }
        }
    }

    // Emit final completed status
    let _ = app.emit(
        "asset_process_status",
        AssetProcessPayload {
            asset_id: None,
            task_type: task_type.to_string(),
            progress: 100.0,
            status: "completed".to_string(),
            message: format!("{} downloaded successfully!", display_name),
        },
    );

    Ok(())
}

/// Checks if the local Whisper model is present.
/// If not, downloads it from Hugging Face and saves it.
pub async fn ensure_whisper_model(
    app: &tauri::AppHandle,
    app_data_dir: &Path,
) -> Result<PathBuf, String> {
    let models_dir = app_data_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    let model_path = models_dir.join("ggml-base.bin");
    if model_path.exists() {
        return Ok(model_path);
    }

    let url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
    download_file_with_progress(app, url, &model_path, "download_whisper", "Whisper model").await?;

    Ok(model_path)
}

/// Checks if the local CLIP vision model is present.
/// If not, downloads it from Hugging Face and saves it.
pub async fn ensure_clip_model(
    app: &tauri::AppHandle,
    app_data_dir: &Path,
) -> Result<PathBuf, String> {
    let models_dir = app_data_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    let model_path = models_dir.join("clip_vision_quantized.onnx");
    if model_path.exists() {
        return Ok(model_path);
    }

    let url = "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model_quantized.onnx";
    download_file_with_progress(
        app,
        url,
        &model_path,
        "download_clip_vision",
        "CLIP vision model",
    )
    .await?;

    Ok(model_path)
}

/// Checks if the local CLIP text model is present.
/// If not, downloads it from Hugging Face and saves it.
pub async fn ensure_clip_text_model(
    app: &tauri::AppHandle,
    app_data_dir: &Path,
) -> Result<PathBuf, String> {
    let models_dir = app_data_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    let model_path = models_dir.join("clip_text_quantized.onnx");
    if model_path.exists() {
        return Ok(model_path);
    }

    let url = "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/text_model_quantized.onnx";
    download_file_with_progress(
        app,
        url,
        &model_path,
        "download_clip_text",
        "CLIP text model",
    )
    .await?;

    Ok(model_path)
}
