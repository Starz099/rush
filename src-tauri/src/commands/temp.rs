use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request};
use tauri::State;

pub struct ExportSession {
    pub child: std::process::Child,
    pub stdin: std::process::ChildStdin,
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
    println!(
        "[Backend] Starting export session: {}x{} @ {}fps, output: {}",
        width, height, fps, output_path
    );

    let mut child = Command::new("ffmpeg")
        .args([
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-s",
            &format!("{}x{}", width, height),
            "-r",
            &fps.to_string(),
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
            &output_path,
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
    *lock = Some(ExportSession { child, stdin });

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
            println!("[Backend Success] Video file exported and closed successfully.");
            Ok(())
        } else {
            Err(format!("FFmpeg failed with exit code: {}", status))
        }
    } else {
        Err("No active export session to finish.".to_string())
    }
}
