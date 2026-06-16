use serde::Serialize;
use std::{
    io::{BufRead, BufReader},
    process::{Command, Stdio},
};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct ProgressPayload {
    progress: f32,
}

pub fn run_render(
    app_handle: &AppHandle,
    inputs: Vec<String>,
    filter_graph: String,
    video_label: String,
    audio_label: Option<String>,
    output_path: String,
    duration_seconds: f32,
) -> Result<(), String> {
    let mut args = Vec::new();

    // Add inputs
    for input in &inputs {
        args.push("-i".to_string());
        args.push(input.clone());
    }

    // Add the complex filter graph
    args.push("-filter_complex".to_string());
    args.push(filter_graph);

    // Map the final video stream from filtergraph to the output
    args.push("-map".to_string());
    args.push(format!("[{}]", video_label));

    // Map the final mixed audio stream from filtergraph if it exists
    if let Some(audio_out) = audio_label {
        args.push("-map".to_string());
        args.push(format!("[{}]", audio_out));
    }

    // Overwrite the output file if it exists
    args.push("-y".to_string());

    // Add the output path
    args.push(output_path);

    // 2. Spawn the ffmpeg process
    println!("Spawning FFmpeg with args: {:?}", args);
    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}", e))?;

    // Take stderr so we can read progress updates
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture FFmpeg stderr".to_string())?;

    let reader = BufReader::new(stderr);

    // 3. Read stderr line by line and parse progress
    for line in reader.lines() {
        let line = line.map_err(|e| format!("Error reading FFmpeg output: {}", e))?;
        println!("[FFmpeg] {}", line);

        if let Some(time_str) = parse_time_field(&line) {
            if let Some(current_seconds) = parse_time_to_seconds(&time_str) {
                if duration_seconds > 0.0 {
                    let progress = (current_seconds / duration_seconds) * 100.0;
                    let progress = progress.clamp(0.0, 100.0);

                    // Emit progress to the frontend
                    let _ = app_handle.emit("render-progress", ProgressPayload { progress });
                }
            }
        }
    }

    // 4. Wait for the process to exit
    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for FFmpeg: {}", e))?;

    if !status.success() {
        return Err("FFmpeg rendering failed. Check output for details.".to_string());
    }

    // Emit 100% progress on completion to be safe
    let _ = app_handle.emit("render-progress", ProgressPayload { progress: 100.0 });

    Ok(())
}

/// Extracts the "time=HH:MM:SS.xx" string from FFmpeg's status line
fn parse_time_field(line: &str) -> Option<String> {
    if let Some(idx) = line.find("time=") {
        let time_part = &line[idx + 5..];
        // Read until the next whitespace
        let time_str = time_part.split_whitespace().next()?;
        Some(time_str.to_string())
    } else {
        None
    }
}

/// Converts an FFmpeg time string (HH:MM:SS.xx) to seconds
fn parse_time_to_seconds(time_str: &str) -> Option<f32> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return None;
    }

    let hours: f32 = parts[0].parse().ok()?;
    let minutes: f32 = parts[1].parse().ok()?;
    let seconds: f32 = parts[2].parse().ok()?;

    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}
