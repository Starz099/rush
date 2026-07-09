use rusqlite::{Error, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct AssetStoryboard {
    pub id: String,
    pub asset_id: String,
    pub timestamp_ms: i32,
    pub description: Option<String>,
    pub motion_score: f64,
    pub is_cut: bool,
    pub created_at: String,
}

impl AssetStoryboard {
    pub fn from_row(row: &Row) -> Result<Self, Error> {
        Ok(Self {
            id: row.get(0)?,
            asset_id: row.get(1)?,
            timestamp_ms: row.get(2)?,
            description: row.get(3)?,
            motion_score: row.get(4)?,
            is_cut: row.get(5)?,
            created_at: row.get(6)?,
        })
    }
}
