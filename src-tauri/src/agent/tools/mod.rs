pub mod effects;
pub mod project;
pub mod retrieval;
pub mod timeline;

use crate::db::models::asset::Asset;
use crate::db::models::clip::TimelineState;
use crate::db::models::project::Project;
use serde_json::Value;

pub fn execute_tool(
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

        _ => Err(format!("Unsupported tool name: '{}'.", tool_name)),
    }
}
