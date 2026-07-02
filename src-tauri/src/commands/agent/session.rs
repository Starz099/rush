use crate::db::models::agent::session::Session;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn create_session(state: State<'_, AppState>, project_id: String) -> Result<Session, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO sessions (id, project_id) VALUES (?1, ?2)",
        (&id, &project_id),
    )
    .map_err(|e| e.to_string())?;

    let session = db
        .query_row(
            "SELECT * FROM sessions WHERE id = ?1",
            [&id],
            Session::from_row,
        )
        .map_err(|e| e.to_string())?;

    Ok(session)
}

#[tauri::command]
#[specta::specta]
pub fn get_sessions(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<Session>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt: rusqlite::Statement<'_> = db
        .prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let session_iter = stmt
        .query_map([&project_id], Session::from_row)
        .map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for session in session_iter {
        sessions.push(session.map_err(|e| e.to_string())?);
    }

    Ok(sessions)
}

#[tauri::command]
#[specta::specta]
pub fn delete_session(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM sessions WHERE id = ?1", [&session_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
