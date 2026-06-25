use crate::commands::export::types::{ExportSession, ExportState, SpeedBlock};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn start_export(
    state: State<'_, ExportState>,
    width: u32,
    height: u32,
    fps: u32,
    output_path: String,
    speed_blocks: Vec<SpeedBlock>,
) -> Result<(), String> {
    let random_uuid = Uuid::new_v4();
    let temp_dir = std::env::temp_dir();
    let temp_video_path = temp_dir.join(format!("temp_video_{}.h264", random_uuid));
    let temp_audio_path = temp_dir.join(format!("temp_audio_{}.raw", random_uuid));

    println!(
        "[Backend] Starting WebCodecs export session: {}x{} @ {}fps. Speed blocks: {}",
        width,
        height,
        fps,
        speed_blocks.len()
    );
    println!(
        "[Backend] Temp video path: {}\n[Backend] Temp audio path: {}",
        temp_video_path.to_string_lossy(),
        temp_audio_path.to_string_lossy()
    );

    // Create the empty files to start
    std::fs::File::create(&temp_video_path)
        .map_err(|e| format!("Failed to create temp video file: {}", e))?;
    std::fs::File::create(&temp_audio_path)
        .map_err(|e| format!("Failed to create temp audio file: {}", e))?;

    let mut lock = state.0.lock().map_err(|e| e.to_string())?;

    *lock = Some(ExportSession {
        temp_video_path,
        temp_audio_path,
        final_output_path: output_path,
        speed_blocks,
        fps,
    });

    Ok(())
}
