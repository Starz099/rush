use crate::models::TrackType;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum EditingTool {
    Select,
    Split,
    Trim,
    Bg,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(tag = "type", content = "params", rename_all = "snake_case")]
pub enum BackgroundSource {
    Solid {
        color_hex: String,
    },
    Gradient {
        gradient_type: String,
        colors: Vec<String>,
        angle_degrees: Option<f32>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum TransitionType {
    Fade,
    Slide,
    Wipe,
    Zoom,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum EaseCurve {
    Linear,
    EaseIn,
    EaseOut,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum Shape {
    Circle,
    Rectangle,
    Arrow,
    Highlighter,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(tag = "type", content = "params", rename_all = "snake_case")]
pub enum EffectConfig {
    Zoom {
        start_scale: f32,
        end_scale: f32,
        center_x: f32,
        center_y: f32,
        ease_curve: EaseCurve,
    },
    Highlight {
        shape: Shape,
        color_hex: String,
        stroke_width: i32,
        animation: String,
    },
    TextOverlay {
        text: String,
        font_family: String,
        font_size: i32,
        color_hex: String,
    },
}

fn default_speed_factor() -> f32 {
    1.0
}

fn default_blur_value() -> u32 {
    0
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct BackgroundConfig {
    pub source: BackgroundSource,
    #[serde(default = "default_blur_value")]
    pub blur_value: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Transition {
    pub id: String,
    pub from_clip_id: String,
    pub to_clip_id: String,
    pub transition_type: TransitionType,
    pub duration_frames: i32,
    pub ease_curve: EaseCurve,
}

pub fn default_background() -> BackgroundConfig {
    BackgroundConfig {
        source: BackgroundSource::Solid {
            color_hex: "#000000".to_string(),
        },
        blur_value: 0,
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct TimelineState {
    pub playhead_position: i32,
    pub tracks: Vec<Track>,
    #[serde(default)]
    pub background: Option<BackgroundConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Track {
    pub id: String,
    pub name: String,
    pub track_type: TrackType,
    pub clips: Vec<Clip>,
    #[serde(default)]
    pub transitions: Vec<Transition>,
    #[serde(default)]
    pub is_muted: bool,
    #[serde(default)]
    pub is_locked: bool,
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
    pub asset_id: Option<String>,
    pub timeline_in: i32,
    pub timeline_out: i32,
    pub source_in: i32,
    pub source_out: i32,
    pub transform: Option<Transform>,
    #[serde(default = "default_speed_factor")]
    pub speed_factor: f32,
    #[serde(default)]
    pub effects: Vec<EffectConfig>,
}
