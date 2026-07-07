pub mod effects;
pub mod project;
pub mod retrieval;
pub mod timeline;

use crate::db::models::asset::Asset;
use crate::db::models::clip::TimelineState;
use crate::db::models::project::Project;
use crate::state::AppState;
use serde_json::Value;
use tauri::Manager;

pub async fn execute_tool(
    app: &tauri::AppHandle,
    tool_name: &str,
    args: Value,
    timeline_state: &mut TimelineState,
    assets: &[Asset],
    project: &Project,
) -> Result<String, String> {
    println!("[tools] Dispatching tool '{}'...", tool_name);

    match tool_name {
        // Context Retrieval Tools
        "get_project_metadata" => retrieval::get_project_metadata(
            &project.name,
            project.viewport_width,
            project.viewport_height,
            project.framerate,
            timeline_state,
        ),
        "get_assets_list" => retrieval::get_assets_list(assets),
        "get_timeline_layout" => retrieval::get_timeline_layout(timeline_state),
        "get_track_details" => retrieval::get_track_details(&args, timeline_state),

        // Timeline Modification Tools
        "add_clip" => timeline::add_clip(&args, timeline_state, assets),
        "delete_clip" => timeline::delete_clip(&args, timeline_state),
        "move_clip" => timeline::move_clip(&args, timeline_state),
        "trim_clip" => timeline::trim_clip(&args, timeline_state),
        "split_clip" => timeline::split_clip(&args, timeline_state),

        // Effects / Spatial Tools
        "update_transform" => effects::update_transform(&args, timeline_state),
        "add_effect" => effects::add_effect(&args, timeline_state),
        "remove_effect" => effects::remove_effect(&args, timeline_state),

        // Project Tools
        "set_background" => project::set_background(&args, timeline_state),
        "set_playhead" => project::set_playhead(&args, timeline_state),
        "mute_track" => project::mute_track(&args, timeline_state),
        "lock_track" => project::lock_track(&args, timeline_state),
        "get_timeline_transcript" => {
            let start_frame = args["start_frame"].as_i64().ok_or("Missing start_frame")? as i32;
            let end_frame = args["end_frame"].as_i64().ok_or("Missing end_frame")? as i32;

            let db_state = app.state::<AppState>();
            let db = db_state.db.lock().map_err(|e| e.to_string())?;

            let composed = crate::asset_processor::composer::audio::compose_transcript(
                &db,
                timeline_state,
                project.framerate,
                start_frame,
                end_frame,
            )?;

            Ok(composed.text)
        }
        "inspect_timeline" => {
            let start_frame = args["start_frame"].as_i64().ok_or("Missing start_frame")? as i32;
            let end_frame = args["end_frame"].as_i64().ok_or("Missing end_frame")? as i32;
            let default_step = (project.framerate as i64 / 4).max(1);
            let step_frames = args["step_frames"].as_i64().unwrap_or(default_step) as i32;
            let base64_image = crate::commands::agent::visual_composer::inspect_timeline(
                app.clone(),
                start_frame,
                end_frame,
                step_frames,
            )
            .await?;

            Ok(format!("[STORYBOARD_IMAGE:base64:{}]", base64_image))
        }
        _ => Err(format!("Unsupported tool name: '{}'.", tool_name)),
    }
}
