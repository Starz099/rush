use crate::db::models::agent::message::Message;
use crate::models::MessageAuthor;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn create_message(
    state: State<'_, AppState>,
    session_id: String,
    role: MessageAuthor,
    content: String,
) -> Result<Message, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let role_str = match role {
        MessageAuthor::User => "user",
        MessageAuthor::Agent => "agent",
    };
    db.execute(
        "INSERT INTO messages (id, session_id, role, content) VALUES (?1, ?2, ?3, ?4)",
        (&id, &session_id, role_str, &content),
    )
    .map_err(|e| e.to_string())?;

    let message = db
        .query_row(
            "SELECT * FROM messages WHERE id = ?1",
            [&id],
            Message::from_row,
        )
        .map_err(|e| e.to_string())?;

    Ok(message)
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
