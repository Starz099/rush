pub mod message;
pub mod save_test_storyboard;
pub mod session;
pub mod visual_composer;

use rush_agent::planner::run_planner;
use rush_db::AppState;
use tauri::Manager;

#[tauri::command]
#[specta::specta]
pub async fn run_agent(
    app: tauri::AppHandle,
    project_id: String,
    session_id: String,
    prompt: String,
    api_url: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    // Determine or create the active session ID
    let mut working_session_id = session_id.clone();
    if working_session_id.is_empty() {
        let session = session::create_session(app.state::<AppState>(), project_id)?;
        working_session_id = session.id;
    } else {
        // If the session ID doesn't exist in DB, insert it
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let exists: bool = db
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sessions WHERE id = ?1)",
                [&working_session_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if !exists {
            drop(db);
            let _ = session::create_session(app.state::<AppState>(), project_id)?;
        }
    }

    // Store the user's prompt message
    message::create_message(
        app.clone(),
        app.state::<AppState>(),
        working_session_id.clone(),
        rush_db::models::presets::MessageAuthor::User,
        prompt.clone(),
    )?;

    // Get response from the planner
    let planner_response = run_planner(
        app.clone(),
        working_session_id.clone(),
        prompt,
        api_url,
        api_key,
        model,
    )
    .await?;

    // Store the agent's response message
    message::create_message(
        app.clone(),
        app.state::<AppState>(),
        working_session_id,
        rush_db::models::presets::MessageAuthor::Agent,
        planner_response.clone(),
    )?;

    Ok(planner_response)
}
