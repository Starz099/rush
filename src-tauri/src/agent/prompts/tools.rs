pub fn get_tools_description() -> &'static str {
    r##"You have access to two categories of tools: Context Retrieval Tools (to fetch project state) and Content Modification Tools (to edit the video).

### CATEGORY 1: CONTEXT RETRIEVAL TOOLS
Use these to inspect the project layout, assets, and clips before deciding to edit. Do not guess IDs.

1. `get_project_metadata`
   - Description: Retrieves project global configurations (name, resolution, framerate, background config, and playhead position).
   - Parameters: None
   - Signature: `get_project_metadata()`

2. `get_assets_list`
   - Description: Lists all media assets imported into this project (IDs, file names, types, durations).
   - Parameters: None
   - Signature: `get_assets_list()`

3. `get_timeline_layout`
   - Description: Lists all tracks on the timeline (IDs, names, track types, muted, locked) but DOES NOT list their clips. Use this first to find track IDs.
   - Parameters: None
   - Signature: `get_timeline_layout()`

4. `get_track_details`
   - Description: Retrieves all clips, transforms, and effects active on a specific track.
   - Parameters:
     - `track_id` (string, required): The ID of the track to inspect.
   - Signature: `get_track_details(track_id)`


### CATEGORY 2: CONTENT MODIFICATION TOOLS
Use these to perform editing actions.

5. `add_clip`
   - Description: Places an asset clip on a specific track.
   - Parameters:
     - `track_id` (string, required): The ID of the track to place the clip on. If the track doesn't exist, provide a new unique track ID.
     - `asset_id` (string, required): The ID of the media asset.
     - `timeline_in` (number, required): Start frame position on the timeline.
     - `duration_frames` (number, required): Duration of the clip in frames.
   - Signature: `add_clip(track_id, asset_id, timeline_in, duration_frames)`

6. `delete_clip`
   - Description: Deletes a clip from the timeline.
   - Parameters:
     - `clip_id` (string, required): The ID of the clip to remove.
   - Signature: `delete_clip(clip_id)`

7. `move_clip`
   - Description: Moves an existing clip to a new start frame position on the timeline (keeps same duration).
   - Parameters:
     - `clip_id` (string, required): The ID of the clip to move.
     - `new_timeline_in` (number, required): The new start frame on the timeline.
   - Signature: `move_clip(clip_id, new_timeline_in)`

8. `trim_clip`
   - Description: Trims or slides the in/out points of a clip.
   - Parameters:
     - `clip_id` (string, required): The ID of the clip to trim.
     - `timeline_in` (number, optional): New start frame on the timeline.
     - `timeline_out` (number, optional): New end frame on the timeline.
     - `source_in` (number, optional): Trim point offset in source asset (frames).
     - `source_out` (number, optional): End trim point in source asset (frames).
   - Signature: `trim_clip(clip_id, timeline_in, timeline_out, source_in, source_out)`

9. `update_transform`
   - Description: Adjusts scale and 2D translation offsets (x, y) of a clip.
   - Parameters:
     - `clip_id` (string, required): Clip ID.
     - `x` (number, optional): X coordinate translation.
     - `y` (number, optional): Y coordinate translation.
     - `scale` (number, optional): Visual size multiplier (e.g. 1.2).
   - Signature: `update_transform(clip_id, x, y, scale)`

10. `add_effect`
    - Description: Adds a filter, zoom, overlay, or speed adjustment to a clip.
    - Parameters:
      - `clip_id` (string, required): Clip ID.
      - `effect_type` (string, required): One of: "zoom", "highlight", "text_overlay", "speed".
      - `config` (object, required): Configurations map:
        - For "zoom": `{ "start_scale": float, "end_scale": float, "center_x": float, "center_y": float, "ease_curve": "ease_in"|"ease_out"|"linear" }`
        - For "text_overlay": `{ "text": string, "font_family": string, "font_size": integer, "color_hex": string }`
        - For "highlight": `{ "shape": "rectangle"|"circle"|"arrow"|"highlighter", "color_hex": string, "stroke_width": integer, "animation": string }`
        - For "speed": `{ "speed_factor": float }`
    - Signature: `add_effect(clip_id, effect_type, config)`

11. `set_background`
    - Description: Sets the canvas background style.
    - Parameters:
      - `color_hex` (string, optional): Hex code for solid background (e.g. "#FF0000").
      - `gradient_colors` (array of strings, optional): List of hex colors for gradient.
      - `blur` (number, optional): Blur filter radius.
    - Signature: `set_background(color_hex, gradient_colors, blur)`

12. `set_playhead`
    - Description: Changes the current timeline position of the playback cursor.
    - Parameters:
      - `position` (number, required): Frame number.
    - Signature: `set_playhead(position)`

13. `mute_track` / `lock_track`
    - Description: Mutes or locks a track.
    - Parameters:
      - `track_id` (string, required): Track ID.
      - `value` (boolean, required): True to lock/mute, false to unlock/unmute.
    - Signature: `mute_track(track_id, value)` / `lock_track(track_id, value)`
"##
}
