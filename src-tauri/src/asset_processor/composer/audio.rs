use crate::db::models::clip::TimelineState;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct ComposedWord {
    pub word: String,
    pub start_frame: i32,
    pub end_frame: i32,
    pub start_ms: i32,
    pub end_ms: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct ComposedTranscript {
    pub text: String,
    pub words: Vec<ComposedWord>,
}

#[derive(Deserialize)]
struct DbTranscriptContent {
    words: Vec<DbWord>,
}

#[derive(Deserialize)]
struct DbWord {
    word: String,
    #[serde(rename = "startMs")]
    start_ms: i32,
    #[serde(rename = "endMs")]
    end_ms: i32,
}

/// Composes the timeline-accurate transcript for a given frame range
pub fn compose_transcript(
    db: &Connection,
    timeline_state: &TimelineState,
    framerate: i32,
    start_frame: i32,
    end_frame: i32,
) -> Result<ComposedTranscript, String> {
    let mut composed_words = Vec::new();

    for track in &timeline_state.tracks {
        if track.is_muted {
            continue;
        }

        for clip in &track.clips {
            let asset_id = match &clip.asset_id {
                Some(id) => id,
                None => continue,
            };

            // Skip clips that do not overlap with our target playhead range
            if clip.timeline_in >= end_frame || clip.timeline_out <= start_frame {
                continue;
            }

            // Retrieve the preprocessed transcript segment rows
            let mut stmt = db
                .prepare("SELECT text FROM asset_transcripts WHERE asset_id = ?1")
                .map_err(|e| format!("Failed to prepare transcript query: {}", e))?;

            let rows = stmt
                .query_map([asset_id], |row| row.get::<_, String>(0))
                .map_err(|e| format!("Failed to execute transcript query: {}", e))?;

            for row in rows {
                let json_str = row.map_err(|e| format!("Failed to read transcript row: {}", e))?;

                // Deserialise the JSON containing segment text and word lists
                let content: DbTranscriptContent = serde_json::from_str(&json_str)
                    .map_err(|e| format!("Failed to parse transcript JSON: {}", e))?;

                for word in content.words {
                    // Convert the word's millisecond timestamps to frame numbers in asset space
                    let word_start_frame =
                        (word.start_ms as f64 * framerate as f64 / 1000.0) as i32;
                    let word_end_frame = (word.end_ms as f64 * framerate as f64 / 1000.0) as i32;
                    let word_center_frame = (word_start_frame + word_end_frame) / 2;

                    // Verify if the word lies within the trimmed crop range of the clip
                    if word_center_frame >= clip.source_in && word_center_frame <= clip.source_out {
                        // Project the frames to timeline space using speed factor
                        let relative_start =
                            (word_start_frame - clip.source_in) as f32 / clip.speed_factor;
                        let relative_end =
                            (word_end_frame - clip.source_in) as f32 / clip.speed_factor;

                        let timeline_start_frame = clip.timeline_in + relative_start.round() as i32;
                        let timeline_end_frame = clip.timeline_in + relative_end.round() as i32;

                        // Check if the projected timeline frames fall inside the query range
                        if timeline_start_frame < end_frame && timeline_end_frame > start_frame {
                            // Calculate timeline-space playhead timestamps in milliseconds
                            let timeline_start_ms =
                                (timeline_start_frame as f64 * 1000.0 / framerate as f64) as i32;
                            let timeline_end_ms =
                                (timeline_end_frame as f64 * 1000.0 / framerate as f64) as i32;

                            composed_words.push(ComposedWord {
                                word: word.word,
                                start_frame: timeline_start_frame,
                                end_frame: timeline_end_frame,
                                start_ms: timeline_start_ms,
                                end_ms: timeline_end_ms,
                            });
                        }
                    }
                }
            }
        }
    }

    composed_words.sort_by_key(|w| w.start_frame);

    let mut text = String::new();
    let mut last_word_end_ms = -10000;

    for w in &composed_words {
        let gap = w.start_ms - last_word_end_ms;
        if gap > 1500 {
            if !text.is_empty() {
                text.push_str("\n");
            }

            let secs = w.start_ms as f32 / 1000.0;
            let minutes = (secs / 60.0) as i32;

            let remaining_secs = secs % 60.0;
            text.push_str(&format!("[{:02}:{:04.1}] ", minutes, remaining_secs));
        } else if !text.is_empty() && !text.ends_with(' ') && !text.ends_with('\n') {
            text.push(' ');
        }

        text.push_str(&w.word);
        last_word_end_ms = w.end_ms;
    }

    Ok(ComposedTranscript {
        text,
        words: composed_words,
    })
}
