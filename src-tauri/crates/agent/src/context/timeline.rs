use rush_db::models::clip::Track;

pub fn format_timeline(tracks: &[Track]) -> String {
    if tracks.is_empty() {
        return "Timeline is empty (no tracks).".to_string();
    }

    let mut output = String::new();
    for (i, track) in tracks.iter().enumerate() {
        output.push_str(&format!(
            "Track #{} (ID: '{}', Name: '{}', Type: '{:?}', Muted: {}, Locked: {}):\n",
            i + 1,
            track.id,
            track.name,
            track.track_type,
            track.is_muted,
            track.is_locked
        ));

        if track.clips.is_empty() {
            output.push_str("  - No clips on this track.\n");
        } else {
            for clip in &track.clips {
                let asset_id_str = clip.asset_id.as_deref().unwrap_or("None (Gap)");
                output.push_str(&format!(
                    "  - Clip ID: '{}'\n    Asset ID: '{}'\n    Timeline Bounds: [{} -> {}] (Duration: {} frames)\n    Source Bounds: [{} -> {}]\n    Speed Factor: {}x\n",
                    clip.id,
                    asset_id_str,
                    clip.timeline_in,
                    clip.timeline_out,
                    clip.timeline_out - clip.timeline_in,
                    clip.source_in,
                    clip.source_out,
                    clip.speed_factor
                ));

                if let Some(ref t) = clip.transform {
                    output.push_str(&format!(
                        "    Transform: {{ x: {}, y: {}, scale: {}, rotation: {}, opacity: {}, z_index: {} }}\n",
                        t.x.value, t.y.value, t.scale.value, t.rotation.value, t.opacity.value, t.z_index
                    ));
                }

                if let Some(ref effect_type) = clip.effect_type {
                    output.push_str(&format!("    Effect Type: {}\n", effect_type));
                    if let Some(ref config) = clip.effect_config {
                        output.push_str(&format!("    Effect Config: {}\n", config));
                    }
                }
            }
        }
        output.push_str("\n");
    }
    output
}
