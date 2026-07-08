pub mod models;

use rusqlite::Connection;
use std::fs;
use std::path::Path;

pub fn initialize_database(app_data_dir: &Path) -> Connection {
    let mut db_path = app_data_dir.to_path_buf();
    fs::create_dir_all(&db_path).expect("Failed to create app data directory");
    db_path.push("workspace.db");

    // Enable SQLite vector extension
    unsafe {
        let _ = rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }

    println!("Mounting database at: {:?}", db_path);
    let db = Connection::open(&db_path).expect("Failed to open database");

    // Enable foreign key support for SQLite
    db.execute("PRAGMA foreign_keys = ON;", [])
        .expect("Failed to enable foreign keys for SQLite database");

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

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS asset_metadata (
            asset_id TEXT PRIMARY KEY,
            bpm REAL DEFAULT 0.0,
            duration_ms INTEGER DEFAULT 0,
            primary_type TEXT,
            mood_tags TEXT,
            amplitude_envelope TEXT,
            beats TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS asset_transcripts (
            id TEXT PRIMARY KEY,
            asset_id TEXT NOT NULL,
            start_ms INTEGER NOT NULL,
            end_ms INTEGER NOT NULL,
            text TEXT NOT NULL,
            speaker_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_asset_transcripts_asset_id ON asset_transcripts(asset_id);

        CREATE TABLE IF NOT EXISTS asset_storyboards (
            id TEXT PRIMARY KEY,
            asset_id TEXT NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            description TEXT,
            motion_score REAL DEFAULT 0.0,
            is_cut INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_asset_storyboards_asset_id ON asset_storyboards(asset_id);

        -- sqlite-vec Virtual Table for 512-dimension visual embeddings
        CREATE VIRTUAL TABLE IF NOT EXISTS asset_embeddings USING vec0(
            embedding float[512],
            +storyboard_id TEXT
        );

        -- Sync Trigger to clean up embeddings when storyboard frame is deleted
        CREATE TRIGGER IF NOT EXISTS delete_asset_embeddings_on_storyboard_delete
        AFTER DELETE ON asset_storyboards
        FOR EACH ROW
        BEGIN
            DELETE FROM asset_embeddings WHERE storyboard_id = OLD.id;
        END;
        ",
    )
    .expect("Failed to run database migrations");

    db
}
