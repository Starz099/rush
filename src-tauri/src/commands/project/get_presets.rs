use crate::models::{
    EditingRegistry, EffectDescriptor, FpsConfig, FpsPreset, PresetsConfig, ResolutionConfig,
    ResolutionPreset, ToolDescriptor,
};

#[tauri::command]
#[specta::specta]
pub fn get_presets() -> PresetsConfig {
    PresetsConfig {
        resolutions: vec![
            ResolutionConfig {
                label: "1080p (16:9)".to_string(),
                value: ResolutionPreset::P1080,
                width: 1920,
                height: 1080,
            },
            ResolutionConfig {
                label: "4K UHD (16:9)".to_string(),
                value: ResolutionPreset::P4K,
                width: 3840,
                height: 2160,
            },
            ResolutionConfig {
                label: "Vertical / Shorts (9:16)".to_string(),
                value: ResolutionPreset::Vertical,
                width: 1080,
                height: 1920,
            },
        ],
        fps_options: vec![
            FpsConfig {
                label: "15 FPS".to_string(),
                value: FpsPreset::F15,
            },
            FpsConfig {
                label: "30 FPS".to_string(),
                value: FpsPreset::F30,
            },
            FpsConfig {
                label: "60 FPS".to_string(),
                value: FpsPreset::F60,
            },
        ],
    }
}

#[tauri::command]
#[specta::specta]
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
