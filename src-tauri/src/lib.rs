mod commands;
mod db;
mod models;
mod state;

use specta_typescript::Typescript;
use state::AppState;
use tauri::Manager;
use tauri_specta::collect_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri_specta::Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::project::create_project,
        commands::project::get_projects,
        commands::project::delete_project,
        commands::project::update_project_name
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings() {
        let builder = tauri_specta::Builder::<tauri::Wry>::new().commands(collect_commands![
            commands::project::create_project,
            commands::project::get_projects,
            commands::project::delete_project,
            commands::project::update_project_name
        ]);

        builder
            .export(Typescript::default(), "../frontend/src/api/bindings.ts")
            .expect("Failed to export specta bindings");
    }
}
