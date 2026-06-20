use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, specta::Type, Clone, Copy, Debug)]
pub enum ResolutionPreset {
    #[serde(rename = "1080p")]
    P1080,
    #[serde(rename = "4k")]
    P4K,
    #[serde(rename = "vertical")]
    Vertical,
}

impl ResolutionPreset {
    pub fn dimensions(&self) -> (i32, i32) {
        match self {
            Self::P1080 => (1920, 1080),
            Self::P4K => (3840, 2160),
            Self::Vertical => (1080, 1920),
        }
    }
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Copy, Debug)]
pub enum FpsPreset {
    #[serde(rename = "15")]
    F15,
    #[serde(rename = "30")]
    F30,
    #[serde(rename = "60")]
    F60,
}

impl FpsPreset {
    pub fn value(&self) -> i32 {
        match self {
            Self::F15 => 15,
            Self::F30 => 30,
            Self::F60 => 60,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum TrackType {
    Video,
    Audio,
    Effects,
}

#[derive(serde::Serialize, specta::Type)]
pub struct RangeResult {
    pub bytes: Vec<u8>,
    pub file_start: f64,
    pub total_length: f64,
}
