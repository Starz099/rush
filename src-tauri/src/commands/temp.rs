use std::io::Write;
use std::process::{Command, Stdio};
use tauri::ipc::{InvokeBody, Request};

#[tauri::command]
pub fn stream_temp(_app: tauri::AppHandle, req: Request<'_>) -> Result<(), String> {
    match req.body() {
        InvokeBody::Raw(bytes) => {
            println!("[IPC Success] Captured raw memory allocation block!");
            println!("Byte length received: {}", bytes.len());
            println!("Data contents: {:?}", bytes);
            Ok(())
        }
        _ => Err("Invalid payload type. Expected a raw binary array.".to_string()),
    }
}

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
