use std::fs::OpenOptions;
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request};
use tauri::State;
use uuid::Uuid;

pub struct ExportSession {
    pub child: std::process::Child,
    pub stdin: std::process::ChildStdin,
    pub temp_video_path: std::path::PathBuf,
    pub temp_audio_path: std::path::PathBuf,
    pub final_output_path: String,
}

pub struct ExportState(pub Mutex<Option<ExportSession>>);

#[tauri::command]
pub fn save_test_frame(_app: tauri::AppHandle, request: Request<'_>) -> Result<(), String> {
    match request.body() {
        InvokeBody::Raw(bytes) => {
            let width_str = request
                .headers()
                .get("x-width")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("1920");
            let height_str = request
                .headers()
                .get("x-height")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("1080");
            let format_str = request
                .headers()
                .get("x-format")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("bgra8unorm");

            println!(
                "[Backend] Received {} bytes of raw frame data. Dimensions: {}x{}, format: {}",
                bytes.len(),
                width_str,
                height_str,
                format_str
            );

            let pix_fmt = if format_str.contains("bgra") {
                "bgra"
            } else {
                "rgba"
            };

            let resolution = format!("{}x{}", width_str, height_str);

            // 1. Configure and spawn the FFmpeg child process
            let mut child = Command::new("ffmpeg")
                .args([
                    "-y", // Overwrite the output file if it exists
                    "-f",
                    "rawvideo", // Explicitly tell FFmpeg the input data is uncompressed raw pixels
                    "-pix_fmt",
                    pix_fmt, // Matches the WebGPU texture format (rgba or bgra)
                    "-s",
                    &resolution, // Dynamic resolution dimensions matching your buffer layout
                    "-i",
                    "-", // Tells FFmpeg to read from standard input pipe instead of a file
                    "-vframes",
                    "1",                  // Stop processing after exactly one frame
                    "../test_output.png", // Output target file name saved to the root folder
                ])
                .stdin(Stdio::piped()) // Capture the stdin file descriptor handle explicitly
                .stdout(Stdio::null()) // Suppress regular stdout noise
                .stderr(Stdio::inherit()) // Forward errors to your main console terminal for debugging
                .spawn()
                .map_err(|e| format!("Failed to spawn FFmpeg process: {}", e))?;

            // 2. Scope the stdin pipe block so it drops and closes naturally
            {
                let mut stdin = child
                    .stdin
                    .take()
                    .ok_or_else(|| "Failed to open handles for FFmpeg stdin stream.".to_string())?;

                // Write the raw bytes directly into the OS kernel buffer ring
                stdin
                    .write_all(bytes)
                    .map_err(|e| format!("Failed writing memory bytes to encoder: {}", e))?;

                // Flush forces the kernel to empty the buffer down the pipe
                stdin
                    .flush()
                    .map_err(|e| format!("Failed flushing pipe streams: {}", e))?;
            } // Stdin drops here, sending an EOF signal to FFmpeg automatically

            // 3. Block execution thread until the encoder finishes writing the image asset
            let status = child
                .wait()
                .map_err(|e| format!("FFmpeg failed during execution pass: {}", e))?;

            if status.success() {
                println!("[Backend Success] test_output.png generated perfectly.");
                Ok(())
            } else {
                Err(format!("FFmpeg exited with error status code: {}", status))
            }
        }
        _ => Err("Invalid payload type. Expected a raw uncompressed binary array.".to_string()),
    }
}

#[tauri::command]
pub fn stream_export_frame(_app: tauri::AppHandle, request: Request<'_>) -> Result<(), String> {
    match request.body() {
        InvokeBody::Raw(bytes) => {
            // Extract frame metadata from headers
            let frame_index = request
                .headers()
                .get("x-frame-index")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(0);

            let timestamp_micros = request
                .headers()
                .get("x-timestamp-micros")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            let width = request
                .headers()
                .get("x-width")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(1920);

            let height = request
                .headers()
                .get("x-height")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(1080);

            let timestamp_secs = (timestamp_micros as f64) / 1_000_000.0;
            let size_mb = (bytes.len() as f64) / (1024.0 * 1024.0);

            // Log details of the frame
            println!(
                "Received frame #{}, timestamp {:.3}s, size {}x{}, bytes: {:.2}MB",
                frame_index, timestamp_secs, width, height, size_mb
            );

            // Memory of `bytes` is immediately dropped here as it goes out of scope
            Ok(())
        }
        _ => Err("Invalid payload type. Expected raw binary bytes.".to_string()),
    }
}

#[tauri::command]
pub fn start_export(
    state: State<'_, ExportState>,
    width: u32,
    height: u32,
    fps: u32,
    output_path: String,
) -> Result<(), String> {
    let random_uuid = Uuid::new_v4();
    let temp_dir = std::env::temp_dir();
    let temp_video_path = temp_dir.join(format!("temp_video_{}.mp4", random_uuid));
    let temp_audio_path = temp_dir.join(format!("temp_audio_{}.wav", random_uuid));

    println!(
        "[Backend] Starting export session: {}x{} @ {}fps",
        width, height, fps
    );
    println!(
        "[Backend] Temp video path: {}\n[Backend] Temp audio path: {}",
        temp_video_path.to_string_lossy(),
        temp_audio_path.to_string_lossy()
    );

    let resolution_str = format!("{}x{}", width, height);
    let fps_str = fps.to_string();
    let temp_video_path_str = temp_video_path.to_string_lossy();

    let mut child = Command::new("ffmpeg")
        .args([
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-s",
            &resolution_str,
            "-r",
            &fps_str,
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-preset",
            "veryfast",
            "-pix_fmt",
            "yuv420p",
            &temp_video_path_str,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit()) // Forward logs to console
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg process: {}", e))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open stdin stream for FFmpeg".to_string())?;

    let mut lock = state.0.lock().map_err(|e| e.to_string())?;

    *lock = Some(ExportSession {
        child,
        stdin,
        temp_video_path,
        temp_audio_path,
        final_output_path: output_path,
    });

    Ok(())
}

#[tauri::command]
pub fn write_export_frame(
    state: State<'_, ExportState>,
    request: Request<'_>,
) -> Result<(), String> {
    match request.body() {
        InvokeBody::Raw(bytes) => {
            let mut lock = state.0.lock().map_err(|e| e.to_string())?;
            if let Some(session) = lock.as_mut() {
                session
                    .stdin
                    .write_all(bytes)
                    .map_err(|e| format!("Failed to write frame bytes to FFmpeg: {}", e))?;
                session
                    .stdin
                    .flush()
                    .map_err(|e| format!("Failed to flush FFmpeg stdin pipe: {}", e))?;
                Ok(())
            } else {
                Err("No active export session found. Did you call start_export?".to_string())
            }
        }
        _ => Err("Invalid payload type. Expected raw binary bytes.".to_string()),
    }
}

#[tauri::command]
pub fn finish_export(state: State<'_, ExportState>) -> Result<(), String> {
    println!("[Backend] Finishing export session.");

    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = lock.take() {
        // Dropping stdin sends EOF to FFmpeg
        drop(session.stdin);

        let status = session
            .child
            .wait()
            .map_err(|e| format!("FFmpeg failed during compile step: {}", e))?;

        if status.success() {
            let temp_video_path_str = session
                .temp_video_path
                .to_str()
                .ok_or_else(|| "Invalid temporary video file path.".to_string())?;

            if session.temp_audio_path.exists() {
                println!("[Backend] Temporary audio file found. Muxing video and audio...");
                let temp_audio_path_str = session
                    .temp_audio_path
                    .to_str()
                    .ok_or_else(|| "Invalid temporary audio file path.".to_string())?;

                // Mux silent video with generated audio
                let mux_status = Command::new("ffmpeg")
                    .args([
                        "-y",
                        "-i",
                        temp_video_path_str,
                        "-f",
                        "s16le", // Raw 16-bit Little-Endian PCM format
                        "-ar",
                        "48000", // Sample rate: 48kHz
                        "-ac",
                        "2", // Stereo channels
                        "-i",
                        temp_audio_path_str,
                        "-c:v",
                        "copy", // Copy video stream directly without transcoding
                        "-c:a",
                        "aac", // Compress audio to AAC format
                        &session.final_output_path,
                    ])
                    .status()
                    .map_err(|e| format!("Failed to spawn FFmpeg muxing process: {}", e))?;

                // Clean up temporary files on disk
                let _ = std::fs::remove_file(&session.temp_video_path);
                let _ = std::fs::remove_file(&session.temp_audio_path);

                if mux_status.success() {
                    println!("[Backend Success] Video file exported and muxed successfully.");
                    Ok(())
                } else {
                    Err(format!("FFmpeg muxing failed with status: {}", mux_status))
                }
            } else {
                println!(
                    "[Backend] No temporary audio file found. Copying silent video directly..."
                );
                std::fs::copy(&session.temp_video_path, &session.final_output_path)
                    .map_err(|e| format!("Failed to copy output video file: {}", e))?;

                // Clean up temporary video file on disk
                let _ = std::fs::remove_file(&session.temp_video_path);

                println!("[Backend Success] Video file exported (silent) successfully.");
                Ok(())
            }
        } else {
            Err(format!("FFmpeg silent video compile failed: {}", status))
        }
    } else {
        Err("No active export session to finish.".to_string())
    }
}

#[tauri::command]
pub fn write_audio_file(state: State<'_, ExportState>, request: Request<'_>) -> Result<(), String> {
    match request.body() {
        InvokeBody::Raw(bytes) => {
            let lock = state.0.lock().map_err(|e| e.to_string())?;
            if let Some(session) = lock.as_ref() {
                let mut file = std::fs::File::create(&session.temp_audio_path)
                    .map_err(|e| format!("Failed to create temp audio file: {}", e))?;
                file.write_all(bytes)
                    .map_err(|e| format!("Failed to write audio bytes: {}", e))?;
                file.flush()
                    .map_err(|e| format!("Failed to flush audio file: {}", e))?;
                println!(
                    "[Backend] Successfully saved temp audio file ({:.2}MB)",
                    (bytes.len() as f64) / (1024.0 * 1024.0)
                );
                Ok(())
            } else {
                Err("No active export session found. Call start_export first.".to_string())
            }
        }
        _ => Err("Invalid payload type. Expected raw binary bytes.".to_string()),
    }
}

#[tauri::command]
pub fn write_audio_chunk(
    state: State<'_, ExportState>,
    request: Request<'_>,
) -> Result<(), String> {
    match request.body() {
        InvokeBody::Raw(bytes) => {
            let lock = state.0.lock().map_err(|e| e.to_string())?;

            if let Some(session) = lock.as_ref() {
                let mut file = OpenOptions::new()
                    .create(true)
                    .write(true)
                    .append(true)
                    .open(&session.temp_audio_path)
                    .map_err(|e| format!("Failed to open temp audio file: {}", e))?;

                file.write_all(bytes)
                    .map_err(|e| format!("Failed to write audio chunk bytes: {}", e))?;

                println!(
                    "[Backend] Appended audio chunk: {:.2} MB",
                    (bytes.len() as f64) / (1024.0 * 1024.0)
                );

                Ok(())
            } else {
                Err("No active export session found.".to_string())
            }
        }
        _ => Err("Invalid payload type. Expected raw binary bytes.".to_string()),
    }
}
