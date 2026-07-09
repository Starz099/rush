use rusqlite::{Error, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Session {
    pub fn from_row(row: &Row) -> Result<Self, Error> {
        Ok(Self {
            id: row.get(0)?,
            project_id: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
        })
    }
}
