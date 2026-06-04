use rusqlite::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub viewport_width: i32,
    pub viewport_height: i32,
    pub framerate: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl Project {
    pub fn from_row(row: &Row) -> Result<Self, rusqlite::Error> {
        Ok(Self {
            id: row.get(0)?,
            name: row.get(1)?,
            viewport_width: row.get(2)?,
            viewport_height: row.get(3)?,
            framerate: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    }
}
