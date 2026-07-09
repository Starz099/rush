use crate::commands::export::speed_filter::build_audio_speed_filter;
use crate::commands::export::types::ExportState;
use tauri::State;

#[tauri::command]
pub fn finish_export(state: State<'_, ExportState>) -> Result<(), String> {
    println!("[Backend] Finishing export session.");

    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(session) = lock.take() {
        let temp_video_path_str = session
            .temp_video_path
            .to_str()
            .ok_or_else(|| "Invalid temporary video file path.".to_string())?;

        let temp_audio_path_str = session
            .temp_audio_path
            .to_str()
            .ok_or_else(|| "Invalid temporary audio file path.".to_string())?;

        if session.temp_audio_path.exists() {
            let file_metadata = std::fs::metadata(&session.temp_audio_path)
                .map_err(|e| format!("Failed to read raw audio metadata: {}", e))?;
            let file_size = file_metadata.len();
            let total_duration_secs = (file_size as f64) / 192000.0;

            let filter_complex_str =
                build_audio_speed_filter(&session.speed_blocks, session.fps, total_duration_secs);

            let mux_status = if !filter_complex_str.is_empty() {
                println!(
                    "[Backend] Muxing H.264 video with speed-warped and pitch-corrected audio..."
                );
                println!("[Backend] Generated filter: {}", filter_complex_str);

                rush_asset_processor::process_helper::create_ffmpeg_command()
                    .args([
                        "-y",
                        "-f",
                        "h264",
                        "-r",
                        &session.fps.to_string(),
                        "-i",
                        temp_video_path_str,
                        "-f",
                        "s16le",
                        "-ar",
                        "48000",
                        "-ac",
                        "2",
                        "-i",
                        temp_audio_path_str,
                        "-filter_complex",
                        &filter_complex_str,
                        "-map",
                        "0:v",
                        "-map",
                        "[aout]",
                        "-c:v",
                        "copy",
                        "-c:a",
                        "aac",
                        &session.final_output_path,
                    ])
                    .status()
                    .map_err(|e| format!("Failed to spawn FFmpeg muxing process: {}", e))?
            } else {
                println!("[Backend] Muxing H.264 video with 1x audio...");
                rush_asset_processor::process_helper::create_ffmpeg_command()
                    .args([
                        "-y",
                        "-f",
                        "h264",
                        "-r",
                        &session.fps.to_string(),
                        "-i",
                        temp_video_path_str,
                        "-f",
                        "s16le",
                        "-ar",
                        "48000",
                        "-ac",
                        "2",
                        "-i",
                        temp_audio_path_str,
                        "-c:v",
                        "copy",
                        "-c:a",
                        "aac",
                        &session.final_output_path,
                    ])
                    .status()
                    .map_err(|e| format!("Failed to spawn FFmpeg muxing process: {}", e))?
            };

            let _ = std::fs::remove_file(&session.temp_video_path);
            let _ = std::fs::remove_file(&session.temp_audio_path);

            if mux_status.success() {
                println!("[Backend Success] Video file exported and muxed successfully.");
                Ok(())
            } else {
                Err(format!("FFmpeg muxing failed with status: {}", mux_status))
            }
        } else {
            println!("[Backend] No temporary audio file found. Muxing silent video directly...");

            let mux_status = rush_asset_processor::process_helper::create_ffmpeg_command()
                .args([
                    "-y",
                    "-f",
                    "h264",
                    "-r",
                    &session.fps.to_string(),
                    "-i",
                    temp_video_path_str,
                    "-c:v",
                    "copy",
                    &session.final_output_path,
                ])
                .status()
                .map_err(|e| format!("Failed to copy output video file: {}", e))?;

            let _ = std::fs::remove_file(&session.temp_video_path);

            if mux_status.success() {
                println!("[Backend Success] Video file exported (silent) successfully.");
                Ok(())
            } else {
                Err(format!(
                    "FFmpeg silent video compile failed: {}",
                    mux_status
                ))
            }
        }
    } else {
        Err("No active export session to finish.".to_string())
    }
}
