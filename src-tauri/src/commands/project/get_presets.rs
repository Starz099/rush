use rush_db::models::presets::{
    EditingRegistry, FpsConfig, FpsPreset, PresetsConfig, ResolutionConfig, ResolutionPreset,
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
    rush_db::models::presets::get_editing_registry()
}
