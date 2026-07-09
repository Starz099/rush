pub mod ai;
pub mod context;
pub mod planner;
pub mod prompts;
pub mod tools;

use rusqlite::Connection;
use tauri::{AppHandle, Emitter};
use rush_db::models::agent::message::Message;
use rush_db::models::presets::MessageAuthor;

/// Helper function to create an agent message, save it to the database, and emit a live event to the frontend.
pub fn create_agent_message(
    app: &AppHandle,
    db: &Connection,
    session_id: &str,
    role: MessageAuthor,
    content: &str,
) -> Result<Message, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let role_str = match role {
        MessageAuthor::User => "user",
        MessageAuthor::Agent => "agent",
        MessageAuthor::Tool => "tool",
    };
    db.execute(
        "INSERT INTO messages (id, session_id, role, content) VALUES (?1, ?2, ?3, ?4)",
        (&id, session_id, role_str, content),
    )
    .map_err(|e| e.to_string())?;

    let message = db
        .query_row(
            "SELECT * FROM messages WHERE id = ?1",
            [&id],
            Message::from_row,
        )
        .map_err(|e| e.to_string())?;

    let _ = app.emit("agent_message_created", &message);

    Ok(message)
}

/// Helper service to request visual timeline snapshots from the frontend, registering a oneshot receiver and awaiting the response.
pub async fn inspect_timeline_service(
    app: AppHandle,
    start_frame: i32,
    end_frame: i32,
    step_frames: i32,
) -> Result<String, String> {
    use tauri::Manager;
    let request_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();

    let state = app.state::<rush_db::AppState>();
    {
        let mut requests = state
            .storyboard_requests
            .lock()
            .map_err(|e| e.to_string())?;
        requests.insert(request_id.clone(), tx);
    }

    #[derive(serde::Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    struct InspectRequestPayload {
        request_id: String,
        start_frame: i32,
        end_frame: i32,
        step_frames: i32,
    }

    app.emit(
        "inspect_timeline_request",
        InspectRequestPayload {
            request_id: request_id.clone(),
            start_frame,
            end_frame,
            step_frames,
        },
    )
    .map_err(|e| format!("Failed to emit inspect request: {}", e))?;

    let base64_image = rx
        .await
        .map_err(|e| format!("Failed to receive timeline snapshots: {}", e))?;

    Ok(base64_image)
}
