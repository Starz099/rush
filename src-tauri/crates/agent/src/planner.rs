use crate::ai::call_llm_messages;
use crate::prompts::build_system_prompt;
use crate::tools::execute_tool;
use rush_db::models::agent::message::Message;
use rush_db::models::asset::Asset;
use rush_db::models::project::Project;
use rush_db::models::{AgentStatus, AgentStatusPayload};
use rush_db::AppState;
use serde_json::Value;
use tauri::{Emitter, Manager};

pub async fn run_planner(
    app: tauri::AppHandle,
    session_id: String,
    _prompt: String,
    api_url: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let resolved_url = api_url
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| std::env::var("RUSH_LLM_API_URL").ok())
        .unwrap_or_else(|| "https://openrouter.ai/api/v1/chat/completions".to_string());

    let resolved_key = api_key
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| std::env::var("RUSH_LLM_API_KEY").ok())
        .unwrap_or_else(|| {
            "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".to_string()
        });

    let resolved_model = model
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| std::env::var("RUSH_LLM_MODEL").ok())
        .unwrap_or_else(|| "nvidia/nemotron-3-ultra-550b-a55b:free".to_string());
    let _ = app.emit(
        "agent_status",
        AgentStatusPayload {
            session_id: session_id.clone(),
            status: AgentStatus::Thinking,
            message: "Analyzing your request and loading timeline...".to_string(),
        },
    );

    let state = app.state::<AppState>();

    // Scoped database retrieval block to auto-drop stmt and lock
    let (project_id, project, assets, history_messages) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;

        // 1. Retrieve the project_id associated with this session from the database
        let project_id: String = db
            .query_row(
                "SELECT project_id FROM sessions WHERE id = ?1",
                [&session_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        // 2. Load the project details (specifically the timeline state)
        let project = db
            .query_row(
                "SELECT id, name, viewport_width, viewport_height, framerate, timeline_state, created_at, updated_at 
                 FROM projects WHERE id = ?1",
                [&project_id],
                Project::from_row,
            )
            .map_err(|e| e.to_string())?;

        // 3. Load the asset registry for this project
        let mut stmt = db
            .prepare(
                "SELECT id, project_id, name, file_path, media_type, thumbnail_path, duration_ms, created_at 
                 FROM assets WHERE project_id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let asset_iter = stmt
            .query_map([&project_id], Asset::from_row)
            .map_err(|e| e.to_string())?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset.map_err(|e| e.to_string())?);
        }

        // 4. Fetch the message history for context management
        let mut stmt_msg = db
            .prepare(
                "SELECT id, session_id, role, content, created_at, updated_at 
                 FROM messages WHERE session_id = ?1 ORDER BY created_at ASC",
            )
            .map_err(|e| e.to_string())?;

        let message_iter = stmt_msg
            .query_map([&session_id], Message::from_row)
            .map_err(|e| e.to_string())?;

        let mut history_messages = Vec::new();
        for msg in message_iter {
            history_messages.push(msg.map_err(|e| e.to_string())?);
        }

        (project_id, project, assets, history_messages)
    };

    // 5. Build system prompt using the documented tools structure
    let editing_registry = rush_db::models::presets::get_editing_registry();
    let mut registry_desc = String::from("Supported Tools:\n");
    for tool in &editing_registry.tools {
        registry_desc.push_str(&format!(
            "- Name: '{}'\n  Label: {}\n  Description: {}\n",
            tool.name, tool.label, tool.description
        ));
    }
    registry_desc.push_str("\nSupported Effects:\n");
    for effect in &editing_registry.effects {
        registry_desc.push_str(&format!(
            "- Name: '{}'\n  Label: {}\n  Description: {}\n  Default Config: {}\n",
            effect.name, effect.label, effect.description, effect.default_config_json
        ));
    }

    let system_prompt = build_system_prompt(&registry_desc);

    // 6. Build the message array for the multi-turn LLM completions call
    let mut messages = Vec::new();
    messages.push(serde_json::json!({
        "role": "system",
        "content": system_prompt
    }));

    for msg in &history_messages {
        match &msg.role {
            rush_db::models::MessageAuthor::Tool => {
                // Skip historical tool execution logs from past turns to prevent context bloat
                continue;
            }
            rush_db::models::MessageAuthor::User => {
                messages.push(serde_json::json!({
                    "role": "user",
                    "content": msg.content.clone()
                }));
            }
            rush_db::models::MessageAuthor::Agent => {
                messages.push(serde_json::json!({
                    "role": "assistant",
                    "content": msg.content.clone()
                }));
            }
        }
    }

    let mut current_timeline = project.timeline_state.clone();
    let mut final_response = "I have processed your request.".to_string();
    let mut loop_count = 0;
    const MAX_LOOPS: i32 = 8; // Increased loop limit to allow for retrieval queries then edits

    // 7. Execute the Agentic ReAct loop
    while loop_count < MAX_LOOPS {
        loop_count += 1;
        println!("[planner] Starting loop iteration {}...", loop_count);

        let _ = app.emit(
            "agent_status",
            AgentStatusPayload {
                session_id: session_id.clone(),
                status: AgentStatus::Thinking,
                message: format!("Thinking (iteration {}/{})...", loop_count, MAX_LOOPS),
            },
        );

        let llm_res = match call_llm_messages(
            messages.clone(),
            &resolved_url,
            &resolved_key,
            &resolved_model,
        )
        .await
        {
            Ok(res) => res,
            Err(e) => {
                let _ = app.emit(
                    "agent_status",
                    AgentStatusPayload {
                        session_id: session_id.clone(),
                        status: AgentStatus::Error,
                        message: format!("LLM Call failed: {}", e),
                    },
                );
                eprintln!("[planner] LLM call failed: {}", e);
                return Err(format!("LLM Call failed: {}", e));
            }
        };

        let cleaned_res = llm_res
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
            .to_string();

        let json_res: Value = match serde_json::from_str(&cleaned_res) {
            Ok(v) => v,
            Err(e) => {
                println!(
                    "[planner] Failed to parse JSON, treating response as plain text: {}",
                    e
                );
                serde_json::json!({
                    "status": "success",
                    "message": cleaned_res
                })
            }
        };

        let status = json_res["status"].as_str().unwrap_or("success");

        if status == "tool_call" {
            let calls = json_res["calls"].as_array();
            if calls.is_none() || calls.unwrap().is_empty() {
                println!("[planner] LLM requested tool_call but provided no calls. Breaking or sending warning feedback.");
                let warning_feedback = "Error: You returned status 'tool_call' but provided an empty or invalid 'calls' list. Please provide at least one tool call in the array, or return status 'success' if you are done.";
                messages.push(serde_json::json!({
                    "role": "assistant",
                    "content": cleaned_res
                }));
                messages.push(serde_json::json!({
                    "role": "user",
                    "content": warning_feedback
                }));
                continue;
            }
            let mut feedback = Vec::new();

            if let Some(calls_list) = calls {
                for call in calls_list {
                    let tool_name = call["tool"].as_str().unwrap_or("");
                    let args = call["args"].clone();

                    let _ = app.emit(
                        "agent_status",
                        AgentStatusPayload {
                            session_id: session_id.clone(),
                            status: AgentStatus::Executing,
                            message: format!("Executing tool: {}", tool_name),
                        },
                    );

                    let call_msg = format!("● Tool Call: {}(args: {})", tool_name, args);
                    let db_state = app.state::<AppState>();
                    if let Ok(db) = db_state.db.lock() {
                        let _ = crate::create_agent_message(
                            &app,
                            &db,
                            &session_id,
                            rush_db::models::MessageAuthor::Tool,
                            &call_msg,
                        );
                    }

                    match execute_tool(
                        &app,
                        tool_name,
                        args,
                        &mut current_timeline,
                        &assets,
                        &project,
                    )
                    .await
                    {
                        Ok(msg) => {
                            let result_msg = format!("● Tool Result: Success ({})", msg);
                            if let Ok(db) = db_state.db.lock() {
                                let _ = crate::create_agent_message(
                                    &app,
                                    &db,
                                    &session_id,
                                    rush_db::models::MessageAuthor::Tool,
                                    &result_msg,
                                );
                            }
                            feedback.push(format!("Success: {}", msg));
                        }
                        Err(e) => {
                            let result_msg = format!("● Tool Result: Error ({})", e);
                            if let Ok(db) = db_state.db.lock() {
                                let _ = crate::create_agent_message(
                                    &app,
                                    &db,
                                    &session_id,
                                    rush_db::models::MessageAuthor::Tool,
                                    &result_msg,
                                );
                            }
                            feedback.push(format!("Error: {}", e));
                        }
                    }
                }
            }

            // Save the updated timeline state back to the database
            let db = state.db.lock().map_err(|e| e.to_string())?;

            for track in &mut current_timeline.tracks {
                track.validate_and_sort_clips();
            }

            let timeline_json =
                serde_json::to_string(&current_timeline).map_err(|e| e.to_string())?;
            db.execute(
                "UPDATE projects SET timeline_state = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
                (&timeline_json, &project_id),
            )
            .map_err(|e| e.to_string())?;
            drop(db);

            let feedback_str = feedback.join("\n");
            println!("[planner] Tool execution feedback: {}", feedback_str);

            let mut content_blocks = Vec::new();
            let mut plain_text = format!("Tool execution feedback:\n{}", feedback_str);

            if let Some(start_idx) = feedback_str.find("[STORYBOARD_IMAGE:base64:") {
                let tag_prefix = "[STORYBOARD_IMAGE:base64:";
                if let Some(end_idx) = feedback_str[start_idx..].find(']') {
                    let full_end = start_idx + end_idx;
                    let base64_start = start_idx + tag_prefix.len();
                    let base64_data = &feedback_str[base64_start..full_end];

                    plain_text = format!(
                        "Tool execution feedback:\n{}[STORYBOARD_IMAGE_ATTACHED]{}",
                        &feedback_str[..start_idx],
                        &feedback_str[full_end + 1..]
                    );

                    content_blocks.push(serde_json::json!({
                        "type": "text",
                        "text": plain_text.clone()
                    }));

                    content_blocks.push(serde_json::json!({
                        "type": "image_url",
                        "image_url": {
                            "url": format!("data:image/jpeg;base64,{}", base64_data)
                        }
                    }));
                }
            }

            let user_content = if content_blocks.is_empty() {
                serde_json::json!(plain_text)
            } else {
                serde_json::json!(content_blocks)
            };

            messages.push(serde_json::json!({
                "role": "assistant",
                "content": cleaned_res
            }));
            messages.push(serde_json::json!({
                "role": "user",
                "content": user_content
            }));
        } else {
            let message_val = &json_res["message"];
            final_response = if message_val.is_string() {
                message_val.as_str().unwrap().to_string()
            } else if message_val.is_object() && message_val["summary"].is_string() {
                message_val["summary"].as_str().unwrap().to_string()
            } else if !message_val.is_null() {
                serde_json::to_string_pretty(message_val).unwrap_or_else(|_| cleaned_res.clone())
            } else {
                cleaned_res.clone()
            };
            break;
        }
    }

    let _ = app.emit(
        "agent_status",
        AgentStatusPayload {
            session_id: session_id.clone(),
            status: AgentStatus::Idle,
            message: "".to_string(),
        },
    );

    Ok(final_response)
}
