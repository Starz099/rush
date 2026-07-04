use rusqlite::{Error, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct AssetMetadata {
    pub asset_id: String,
    pub bpm: f64,
    pub duration_ms: i32,
    pub primary_type: Option<String>,
    pub mood_tags: Option<String>,
    pub created_at: String,
}

impl AssetMetadata {
    pub fn from_row(row: &Row) -> Result<Self, Error> {
        Ok(Self {
            asset_id: row.get(0)?,
            bpm: row.get(1)?,
            duration_ms: row.get(2)?,
            primary_type: row.get(3)?,
            mood_tags: row.get(4)?,
            created_at: row.get(5)?,
        })
    }
}
