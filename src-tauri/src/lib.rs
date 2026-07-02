mod agent;
mod commands;
mod db;
mod models;
mod state;

#[cfg(debug_assertions)]
use specta_typescript::Typescript;
use state::AppState;
use tauri::{generate_handler, Manager};
use tauri_specta::collect_commands;

macro_rules! run_with_commands {
    ($macro:ident $(, $extra:path)*) => {
        $macro![
            // --- PROJECT COMMANDS ---
            commands::project::create_project::create_project,
            commands::project::get_projects::get_projects,
            commands::project::get_project::get_project,
            commands::project::delete_project::delete_project,
            commands::project::update_project_name::update_project_name,
            commands::project::save_project_timeline::save_project_timeline,
            commands::project::get_presets::get_presets,
            commands::project::get_presets::get_editing_registry,

            // --- ASSET COMMANDS ---
            commands::asset::register_asset::register_asset,
            commands::asset::get_assets::get_assets,
            commands::asset::delete_asset::delete_asset,
            commands::asset::rename_asset::rename_asset,
            commands::asset::read_asset_bytes::read_asset_bytes,
            commands::asset::extract_audio::extract_audio,
            commands::asset::read_asset_range::read_asset_range,
            commands::asset::read_moov_box::read_moov_box,
            commands::asset::slice_audio_asset::slice_audio_asset,

            // --- ASSET COMMANDS ---
            commands::agent::run_agent,
            commands::agent::message::get_messages,
            commands::agent::message::create_message,
            commands::agent::session::get_sessions,
            commands::agent::session::create_session,
            commands::agent::session::delete_session
            $(, $extra)*
        ]
    };
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder =
        tauri_specta::Builder::<tauri::Wry>::new().commands(run_with_commands![collect_commands]);

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../frontend/src/api/bindings.ts")
        .expect("Failed to export specta bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            // Clean the extracted audio cache on startup to reclaim disk space and prevent stale audio cache
            let cache_dir = app_data_dir.join("extracted_audio");
            if cache_dir.exists() {
                let _ = std::fs::remove_dir_all(&cache_dir);
            }

            let connection = db::initialize_database(&app_data_dir);
            app.manage(AppState {
                db: std::sync::Mutex::new(connection),
            });
            app.manage(commands::export::types::ExportState(std::sync::Mutex::new(
                None,
            )));

            Ok(())
        })
        .invoke_handler(run_with_commands![
            generate_handler,
            // --- EXPORT PIPELINE COMMANDS ---
            commands::export::save_test_frame::save_test_frame,
            commands::export::start_export::start_export,
            commands::export::write_video_chunk::write_video_chunk,
            commands::export::write_audio_file::write_audio_file,
            commands::export::write_audio_chunk::write_audio_chunk,
            commands::export::finish_export::finish_export,
            commands::export::cancel_export::cancel_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
