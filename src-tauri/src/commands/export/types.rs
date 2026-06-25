use std::sync::Mutex;

#[derive(serde::Serialize, serde::Deserialize, specta::Type, Clone, Debug)]
pub struct SpeedBlock {
    pub start_frame: u32,
    pub end_frame: u32,
    pub factor: f64,
}

pub struct ExportSession {
    pub temp_video_path: std::path::PathBuf,
    pub temp_audio_path: std::path::PathBuf,
    pub final_output_path: String,
    pub speed_blocks: Vec<SpeedBlock>,
    pub fps: u32,
}

pub struct ExportState(pub Mutex<Option<ExportSession>>);
