use rusqlite::{Error, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct AssetTranscript {
    pub id: String,
    pub asset_id: String,
    pub start_ms: i32,
    pub end_ms: i32,
    pub text: String,
    pub speaker_id: Option<String>,
    pub created_at: String,
}

impl AssetTranscript {
    pub fn from_row(row: &Row) -> Result<Self, Error> {
        Ok(Self {
            id: row.get(0)?,
            asset_id: row.get(1)?,
            start_ms: row.get(2)?,
            end_ms: row.get(3)?,
            text: row.get(4)?,
            speaker_id: row.get(5)?,
            created_at: row.get(6)?,
        })
    }
}
