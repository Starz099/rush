use crate::db::models::clip::TimelineState;
use rusqlite::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub viewport_width: i32,
    pub viewport_height: i32,
    pub framerate: i32,
    pub timeline_state: TimelineState,
    pub created_at: String,
    pub updated_at: String,
}

impl Project {
    pub fn from_row(row: &Row) -> Result<Self, rusqlite::Error> {
        let timeline_state_str: String = row.get(5)?;
        let timeline_state: TimelineState =
            serde_json::from_str(&timeline_state_str).unwrap_or(TimelineState {
                playhead_position: 0,
                tracks: vec![],
                background: None,
            });

        Ok(Self {
            id: row.get(0)?,
            name: row.get(1)?,
            viewport_width: row.get(2)?,
            viewport_height: row.get(3)?,
            framerate: row.get(4)?,
            timeline_state,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    }
}
