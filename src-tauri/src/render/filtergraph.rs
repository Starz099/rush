use crate::models::TrackType;
use crate::render::filters::audio;
use crate::render::filters::video;
use crate::render::filters::{AudioFilter, VideoFilter};
use crate::render::models::RenderTimeline;
use std::collections::HashMap;
pub struct TimelineCompiler {
    timeline: RenderTimeline,
}

impl TimelineCompiler {
    pub fn new(timeline: RenderTimeline) -> Self {
        Self { timeline }
    }

    pub fn compile(&self) -> Result<(Vec<String>, String, String, Option<String>), String> {
        let mut input_paths: Vec<String> = Vec::new();
        let mut input_indices: HashMap<String, usize> = HashMap::new();
        let mut filter_steps = Vec::new();

        // initialize with black canvas
        filter_steps.push(format!(
            "color=c=black:s={}x{}:d={}[v_base]",
            self.timeline.width, self.timeline.height, self.timeline.duration_seconds
        ));

        let mut current_video_stream = "v_base".to_string();
        let mut audio_streams: Vec<String> = Vec::new();

        let mut get_input_index = |file_path: &str| -> usize {
            if let Some(&index) = input_indices.get(file_path) {
                index
            } else {
                let index = input_paths.len();
                input_paths.push(file_path.to_string());
                input_indices.insert(file_path.to_string(), index);
                index
            }
        };

        // Loop through all tracks and compile clips
        for (track_idx, track) in self.timeline.tracks.iter().enumerate() {
            for (clip_idx, clip) in track.clips.iter().enumerate() {
                let input_idx = get_input_index(&clip.file_path);

                match track.track_type {
                    TrackType::Video => {
                        let clip_label = format!("v_t{}c{}", track_idx, clip_idx);

                        let scale_filter = if let Some(t) = &clip.transform {
                            video::scale::ScaleFilter {
                                width: t.width,
                                height: t.height,
                            }
                        } else {
                            video::scale::ScaleFilter {
                                width: self.timeline.width,
                                height: self.timeline.height,
                            }
                        };

                        filter_steps.push(format!(
                            "[{}:v]{}[{}]",
                            input_idx,
                            scale_filter.compile(),
                            clip_label
                        ));

                        let next_video_stream = format!("v_canvas_t{}c{}", track_idx, clip_idx);
                        let (x, y) = if let Some(t) = &clip.transform {
                            let w = t.width;
                            let h = t.height;
                            let x_offset = (self.timeline.width - w) / 2 + t.x;
                            let y_offset = (self.timeline.height - h) / 2 + t.y;
                            (x_offset, y_offset)
                        } else {
                            (0, 0)
                        };

                        let overlay_filter = video::overlay::OverlayFilter {
                            x,
                            y,
                            start_time: clip.timeline_in,
                            end_time: clip.timeline_out,
                        };

                        filter_steps.push(format!(
                            "[{}][{}]{}[{}]",
                            current_video_stream,
                            clip_label,
                            overlay_filter.compile(),
                            next_video_stream
                        ));

                        current_video_stream = next_video_stream;
                    }
                    TrackType::Audio => {
                        let audio_label = format!("a_t{}c{}", track_idx, clip_idx);
                        let delay_ms = (clip.timeline_in * 1000.0) as i64;

                        let delay_filter = audio::delay::DelayFilter { delay_ms };
                        let volume_filter = audio::volume::VolumeFilter {
                            factor: clip.volume,
                        };

                        filter_steps.push(format!(
                            "[{}:a]{},{}[{}]",
                            input_idx,
                            delay_filter.compile(),
                            volume_filter.compile(),
                            audio_label
                        ));

                        audio_streams.push(audio_label);
                    }
                }
            }
        }

        if !audio_streams.is_empty() {
            let audio_inputs = audio_streams
                .iter()
                .map(|tag| format!("[{}]", tag))
                .collect::<Vec<String>>()
                .join("");

            filter_steps.push(format!(
                "{}amix=inputs={}:duration=first[a_mixed]",
                audio_inputs,
                audio_streams.len()
            ));
        }

        let compiled_filtergraph = filter_steps.join("; ");
        let audio_label = if !audio_streams.is_empty() {
            Some("a_mixed".to_string())
        } else {
            None
        };
        Ok((
            input_paths,
            compiled_filtergraph,
            current_video_stream,
            audio_label,
        ))
    }
}
