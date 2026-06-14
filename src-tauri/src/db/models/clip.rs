use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct TimelineState {
    pub playhead_position: i32,
    pub tracks: Vec<Track>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Track {
    pub id: String,
    pub name: String,
    pub track_type: String, // "video" or "audio"
    pub clips: Vec<Clip>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Transform {
    pub x: f32,
    pub y: f32,
    pub scale: f32,
    pub z_index: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Clip {
    pub id: String,
    pub asset_id: String,
    pub timeline_in: i32,
    pub timeline_out: i32,
    pub source_in: i32,
    pub source_out: i32,
    pub transform: Option<Transform>,
}
