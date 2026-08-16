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

5. `get_timeline_transcript`
      - Description: Compiles a playhead-accurate speech transcript for a given frame range by shifting and sorting pre-recorded asset
transcripts.
      - Parameters:
        - `start_frame` (number, required): Start frame.
        - `end_frame` (number, required): End frame.
      - Signature: `get_timeline_transcript(start_frame, end_frame)`

6. `inspect_timeline`
    - Description: Captures a composed visual storyboard of the timeline for a given playhead range by triggering the frontend WebGPU
compositor.
    - Parameters:
      - `start_frame` (number, required): Start frame.
      - `end_frame` (number, required): End frame.
      - `step_frames` (number, required): Interval in frames (e.g. 15 frames = 500ms at 30 FPS).
    - Signature: `inspect_timeline(start_frame, end_frame, step_frames)`

7. `search_storyboard_embeddings`
   - Description: Performs a semantic visual search on the storyboard keyframes of a specific media asset using natural language. Use this to locate visual contents (e.g. "a dog playing", "person smiling", "beach transition") within a raw video.
   - Parameters:
     - `asset_id` (string, required): The ID of the media asset.
     - `query_text` (string, required): The descriptive search query (e.g. "black car").
     - `limit` (number, optional): Max matches to return (defaults to 5).
   - Signature: `search_storyboard_embeddings(asset_id, query_text, limit)`

8. `search_assets_transcripts`
   - Description: Searches the speech transcripts of all imported media assets in this project for a given keyword query or text match. Use this to locate spoken content (e.g. "when do I say 'agentic coding'", "find where the interview talks about pricing") across all media.
   - Parameters:
     - `query_text` (string, required): The exact or substring search query text (e.g. "agentic coding").
     - `limit` (number, optional): Max matches to return (defaults to 10).
   - Signature: `search_assets_transcripts(query_text, limit)`

9. `get_asset_transcript`
   - Description: Retrieves the complete spoken transcript with millisecond timestamps for a given asset ID. Use this to read the entire transcript of an asset.
   - Parameters:
     - `asset_id` (string, required): The ID of the media asset.
   - Signature: `get_asset_transcript(asset_id)`


### CATEGORY 2: CONTENT MODIFICATION TOOLS
Use these to perform editing actions.

10. `add_clip`
   - Description: Places an asset clip on a specific track.
   - Parameters:
     - `track_id` (string, required): The ID of the track to place the clip on. If the track doesn't exist, provide a new unique track ID.
     - `asset_id` (string, required): The ID of the media asset.
     - `timeline_in` (number, required): Start frame position on the timeline.
     - `duration_frames` (number, required): Duration of the clip in frames.
   - Signature: `add_clip(track_id, asset_id, timeline_in, duration_frames)`

11. `delete_clip`
   - Description: Deletes a clip from the timeline.
   - Parameters:
     - `clip_id` (string, required): The ID of the clip to remove.
   - Signature: `delete_clip(clip_id)`

12. `move_clip`
   - Description: Moves an existing clip to a new start frame position on the timeline (keeps same duration). Can optionally move it to a different track.
   - Parameters:
     - `clip_id` (string, required): The ID of the clip to move.
     - `new_timeline_in` (number, required): The new start frame on the timeline.
     - `new_track_id` (string, optional): The target track ID if shifting tracks.
   - Signature: `move_clip(clip_id, new_timeline_in, new_track_id)`

13. `trim_clip`
   - Description: Trims or slides the in/out points of a clip.
   - Parameters:
     - `clip_id` (string, required): The ID of the clip to trim.
     - `timeline_in` (number, optional): New start frame on the timeline.
     - `timeline_out` (number, optional): New end frame on the timeline.
     - `source_in` (number, optional): Trim point offset in source asset (frames).
     - `source_out` (number, optional): End trim point in source asset (frames).
   - Signature: `trim_clip(clip_id, timeline_in, timeline_out, source_in, source_out)`

14. `split_clip`
   - Description: Splits a single clip at a specific timeline frame into two separate sequential clips.
   - Parameters:
     - `clip_id` (string, required): The ID of the clip to split.
     - `split_frame` (number, required): The timeline frame number at which the split occurs.
   - Signature: `split_clip(clip_id, split_frame)`

15. `close_timeline_gaps`
   - Description: Automatically closes all silent empty gaps on a specific track by shifting clips back-to-back chronologically.
   - Parameters:
     - `track_id` (string, required): The ID of the track.
     - `preserve_start` (boolean, optional): If true, preserves the starting position of the first clip instead of shifting it to frame 0 (defaults to false).
   - Signature: `close_timeline_gaps(track_id, preserve_start)`

16. `ripple_delete_clip`
   - Description: Deletes a clip from the timeline and automatically shifts all subsequent clips left on that track to close the resulting gap.
   - Parameters:
     - `clip_id` (string, required): The ID of the clip to remove.
   - Signature: `ripple_delete_clip(clip_id)`

17. `update_transform`
    - Description: Adjusts scale and 2D translation offsets (x, y) of a clip.
    - Parameters:
      - `clip_id` (string, required): Clip ID.
      - `x` (number, optional): X coordinate translation.
      - `y` (number, optional): Y coordinate translation.
      - `scale` (number, optional): Visual size multiplier (e.g. 1.2).
    - Signature: `update_transform(clip_id, x, y, scale)`

18. `add_effect`
    - Description: Adds a zoom or speed adjustment to a clip.
    - Parameters:
      - `clip_id` (string, required): Clip ID.
      - `effect_type` (string, required): One of: "zoom", "speed".
      - `config` (object, required): Configurations map:
        - For "zoom": `{ "start_scale": float, "end_scale": float, "center_x": float, "center_y": float, "ease_curve": "ease_in"|"ease_out"|"linear" }`
        - For "speed": `{ "speed_factor": float }`
    - Signature: `add_effect(clip_id, effect_type, config)`

19. `remove_effect`
    - Description: Removes an existing effect or speed adjustment from a clip.
    - Parameters:
      - `clip_id` (string, required): The ID of the clip.
      - `effect_type` (string, required): The effect type to remove ("zoom", "speed").
    - Signature: `remove_effect(clip_id, effect_type)`

20. `set_background`
    - Description: Sets the canvas background style.
    - Parameters:
      - `color_hex` (string, optional): Hex code for solid background (e.g. "#FF0000").
      - `gradient_colors` (array of strings, optional): List of hex colors for gradient.
      - `blur` (number, optional): Blur filter radius.
    - Signature: `set_background(color_hex, gradient_colors, blur)`

21. `set_playhead`
    - Description: Changes the current timeline position of the playback cursor.
    - Parameters:
      - `position` (number, required): Frame number.
    - Signature: `set_playhead(position)`

22. `mute_track` / `lock_track`
    - Description: Mutes or locks a track.
    - Parameters:
      - `track_id` (string, required): Track ID.
      - `value` (boolean, required): True to lock/mute, false to unlock/unmute.
    - Signature: `mute_track(track_id, value)` / `lock_track(track_id, value)`
"##
}
