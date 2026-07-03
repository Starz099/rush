use crate::models::MessageAuthor;
use rusqlite::{Error, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: MessageAuthor,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Message {
    pub fn from_row(row: &Row) -> Result<Self, Error> {
        let role_str: String = row.get(2)?;
        let role = match role_str.as_str() {
            "user" => MessageAuthor::User,
            "tool" => MessageAuthor::Tool,
            _ => MessageAuthor::Agent,
        };
        Ok(Self {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role,
            content: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }
}
