use serde::{Deserialize, Serialize};
use specta::Type;
#[derive(Serialize, Deserialize, Type, Clone, Copy, Debug)]
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

#[derive(Serialize, Deserialize, Type, Clone, Copy, Debug)]
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

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Type)]
#[serde(rename_all = "lowercase")]
pub enum TrackType {
    Video,
    Audio,
    Effects,
}

#[derive(Serialize, Type)]
pub struct RangeResult {
    pub bytes: Vec<u8>,
    pub file_start: f64,
    pub total_length: f64,
}

#[derive(Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResolutionConfig {
    pub label: String,
    pub value: ResolutionPreset,
    pub width: i32,
    pub height: i32,
}

#[derive(Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FpsConfig {
    pub label: String,
    pub value: FpsPreset,
}

#[derive(Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PresetsConfig {
    pub resolutions: Vec<ResolutionConfig>,
    pub fps_options: Vec<FpsConfig>,
}

#[derive(Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToolDescriptor {
    pub name: String,
    pub label: String,
    pub description: String,
}

#[derive(Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EffectDescriptor {
    pub name: String,
    pub label: String,
    pub description: String,
    pub default_duration_frames: i32,
    pub default_config_json: String,
}

#[derive(Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EditingRegistry {
    pub tools: Vec<ToolDescriptor>,
    pub effects: Vec<EffectDescriptor>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub enum MessageAuthor {
    User,
    Agent,
    Tool,
}

#[derive(Serialize, Deserialize, Type, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentStatus {
    Thinking,
    Executing,
    Error,
    Idle,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusPayload {
    pub session_id: String,
    pub status: AgentStatus,
    pub message: String,
}

pub fn get_editing_registry() -> EditingRegistry {
    EditingRegistry {
        tools: vec![
            ToolDescriptor {
                name: "select".to_string(),
                label: "Select Tool".to_string(),
                description: "Select and drag clips to reposition them on the timeline tracks."
                    .to_string(),
            },
            ToolDescriptor {
                name: "split".to_string(),
                label: "Split Tool".to_string(),
                description:
                    "Click on any clip in the timeline to split it at the cursor position."
                        .to_string(),
            },
            ToolDescriptor {
                name: "trim".to_string(),
                label: "Trim Tool".to_string(),
                description: "Drag the edge of any clip on the timeline to crop its duration."
                    .to_string(),
            },
            ToolDescriptor {
                name: "bg".to_string(),
                label: "Background Config".to_string(),
                description:
                    "Select custom color gradients and blur filters for the viewport background."
                        .to_string(),
            },
        ],
        effects: vec![
            EffectDescriptor {
                name: "zoom".to_string(),
                label: "Zoom Effect".to_string(),
                description: "Apply dynamic canvas zoom and camera pan transformations."
                    .to_string(),
                default_duration_frames: 150,
                default_config_json: r#"{"x": 0.0, "y": 0.0, "scale": 1.2, "z_index": 0}"#
                    .to_string(),
            },
            EffectDescriptor {
                name: "speed".to_string(),
                label: "Speed Effect".to_string(),
                description: "Speed up or slow down clip playback speeds.".to_string(),
                default_duration_frames: 150,
                default_config_json: r#"{"speed_factor": 2.0}"#.to_string(),
            },
        ],
    }
}
