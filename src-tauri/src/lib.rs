mod commands;
mod db;
mod models;
mod render;
mod state;

#[cfg(debug_assertions)]
use specta_typescript::Typescript;
use state::AppState;
use tauri::Manager;
use tauri_specta::collect_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri_specta::Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::project::create_project,
        commands::project::get_projects,
        commands::project::get_project,
        commands::project::delete_project,
        commands::project::update_project_name,
        commands::project::save_project_timeline,
        commands::project::export_project,
        commands::asset::register_asset,
        commands::asset::get_assets,
        commands::asset::delete_asset,
        commands::asset::rename_asset,
        commands::asset::read_asset_bytes,
        commands::asset::extract_audio,
        commands::asset::read_asset_range,
        commands::asset::read_moov_box
    ]);

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../frontend/src/api/bindings.ts")
        .expect("Failed to export specta bindings");

    tauri::Builder::default()
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

            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}