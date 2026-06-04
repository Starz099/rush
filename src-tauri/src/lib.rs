mod commands;
mod db;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let connection = db::initialize_database(&app_data_dir);
            app.manage(AppState {
                db: std::sync::Mutex::new(connection),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::get_projects,
            commands::project::delete_project,
            commands::project::update_project_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
