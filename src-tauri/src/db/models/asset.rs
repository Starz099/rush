use rusqlite::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct Asset {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub file_path: String,
    pub media_type: String,
    pub thumbnail_path: Option<String>,
    pub duration_ms: Option<i32>,
    pub created_at: String,
}

impl Asset {
    pub fn from_row(row: &Row) -> Result<Self, rusqlite::Error> {
        Ok(Self {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            file_path: row.get(3)?,
            media_type: row.get(4)?,
            thumbnail_path: row.get(5)?,
            duration_ms: row.get(6)?,
            created_at: row.get(7)?,
        })
    }
}
