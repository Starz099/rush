pub mod models;

use rusqlite::Connection;
use std::fs;
use std::path::Path;

pub fn initialize_database(app_data_dir: &Path) -> Connection {
    let mut db_path = app_data_dir.to_path_buf();
    fs::create_dir_all(&db_path).expect("Failed to create app data directory");
    db_path.push("workspace.db");

    println!("Mounting database at: {:?}", db_path);
    let db = Connection::open(&db_path).expect("Failed to open database");

    db.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            viewport_width INTEGER DEFAULT 1920,
            viewport_height INTEGER DEFAULT 1080,
            framerate INTEGER DEFAULT 60,
            timeline_state TEXT DEFAULT '{\"playhead_position\":0,\"tracks\":[]}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            media_type TEXT NOT NULL,
            thumbnail_path TEXT,
            duration_ms INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        ",
    )
    .expect("Failed to run database migrations");

    db
}
