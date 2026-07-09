use rush_db::models::agent::message::Message;
use rush_db::models::presets::MessageAuthor;
use rush_db::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
#[specta::specta]
pub fn create_message(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    role: MessageAuthor,
    content: String,
) -> Result<Message, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    rush_agent::create_agent_message(&app, &db, &session_id, role, &content)
}

#[tauri::command]
#[specta::specta]
pub fn get_messages(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<Message>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare("SELECT * FROM messages WHERE session_id = ?1 ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

    let message_iter = stmt
        .query_map([&session_id], Message::from_row)
        .map_err(|e| e.to_string())?;

    let mut messages = Vec::new();
    for message in message_iter {
        messages.push(message.map_err(|e| e.to_string())?);
    }

    Ok(messages)
}
