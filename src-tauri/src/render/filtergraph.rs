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

        // Initialize with background configuration
        let bg_filter = video::background::BackgroundFilter {
            width: self.timeline.width,
            height: self.timeline.height,
            duration_seconds: self.timeline.duration_seconds,
            background: self.timeline.background.clone(),
            framerate: self.timeline.framerate,
        };

        filter_steps.push(format!("{}[v_base]", bg_filter.compile()));

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
            if track.track_type == TrackType::Effects {
                continue;
            }
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

                        let trim_filter = video::trim::TrimFilter {
                            start: clip.source_in,
                            end: clip.source_out,
                            timeline_in: clip.timeline_in,
                        };

                        filter_steps.push(format!(
                            "[{}:v]{},{}[{}]",
                            input_idx,
                            trim_filter.compile(),
                            scale_filter.compile(),
                            clip_label
                        ));

                        // Extract and mix audio if the video asset contains an audio stream
                        if clip.media_type == "video" && has_audio_stream(&clip.file_path) {
                            let video_audio_label = format!("a_v_t{}c{}", track_idx, clip_idx);
                            let delay_ms = (clip.timeline_in * 1000.0) as i64;

                            let audio_trim = audio::trim::TrimFilter {
                                start: clip.source_in,
                                end: clip.source_out,
                            };
                            let delay_filter = audio::delay::DelayFilter { delay_ms };
                            let volume_filter = audio::volume::VolumeFilter {
                                factor: clip.volume,
                            };

                            filter_steps.push(format!(
                                "[{}:a]{},{},{}[{}]",
                                input_idx,
                                audio_trim.compile(),
                                delay_filter.compile(),
                                volume_filter.compile(),
                                video_audio_label
                            ));

                            audio_streams.push(video_audio_label);
                        }

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

                        let trim_filter = audio::trim::TrimFilter {
                            start: clip.source_in,
                            end: clip.source_out,
                        };
                        let delay_filter = audio::delay::DelayFilter { delay_ms };
                        let volume_filter = audio::volume::VolumeFilter {
                            factor: clip.volume,
                        };

                        filter_steps.push(format!(
                            "[{}:a]{},{},{}[{}]",
                            input_idx,
                            trim_filter.compile(),
                            delay_filter.compile(),
                            volume_filter.compile(),
                            audio_label
                        ));

                        audio_streams.push(audio_label);
                    }
                    TrackType::Effects => {}
                }
            }
        }

        // Apply global zoom and speed effects from the effects tracks to the final composite video stream
        let mut effect_clip_idx = 0;
        let mut speed_clip_idx = 0;
        let mut cumulative_offset: f64 = 0.0;

        for track in &self.timeline.tracks {
            if track.track_type == TrackType::Effects {
                // Apply zoom effects first (they do not alter timestamps)
                for clip in &track.clips {
                    let scale = clip
                        .transform
                        .as_ref()
                        .map(|t| t.width as f64 / self.timeline.width as f64)
                        .unwrap_or(1.0);

                    // Only apply if the scale/zoom is different from 1.0
                    if (scale - 1.0).abs() > 0.001 {
                        let next_video_stream = format!("v_effect_{}", effect_clip_idx);
                        effect_clip_idx += 1;

                        // Apply global zoompan filter with timeline-enabled zoom factor expression using frame index (in)
                        filter_steps.push(format!(
                            "[{}]zoompan=z='if(between((in-1)/{},{:.3},{:.3}),{:.4},1)':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s={}x{}:fps={}[{}]",
                            current_video_stream,
                            self.timeline.framerate,
                            clip.timeline_in,
                            clip.timeline_out,
                            scale,
                            self.timeline.width,
                            self.timeline.height,
                            self.timeline.framerate,
                            next_video_stream
                        ));

                        current_video_stream = next_video_stream;
                    }
                }
            }
        }

        // Apply Speed Effects chronologically
        let mut speed_clips: Vec<&crate::render::models::RenderClip> = Vec::new();
        for track in &self.timeline.tracks {
            if track.track_type == TrackType::Effects {
                for clip in &track.clips {
                    if (clip.speed_factor - 1.0).abs() > 0.001 {
                        speed_clips.push(clip);
                    }
                }
            }
        }
        speed_clips.sort_by(|a, b| a.timeline_in.partial_cmp(&b.timeline_in).unwrap());

        for clip in &speed_clips {
            let next_video_stream = format!("v_speed_{}", speed_clip_idx);
            speed_clip_idx += 1;

            let t_in = clip.timeline_in - cumulative_offset;
            let t_out = clip.timeline_out - cumulative_offset;

            let speed_filter = video::speed::SpeedFilter {
                t_in,
                t_out,
                speed_factor: clip.speed_factor as f64,
            };

            filter_steps.push(format!(
                "[{}]{}[{}]",
                current_video_stream,
                speed_filter.compile(),
                next_video_stream
            ));

            current_video_stream = next_video_stream;
            cumulative_offset +=
                (clip.timeline_out - clip.timeline_in) * (1.0 - 1.0 / clip.speed_factor as f64);
        }

        let mut final_audio_label = if !audio_streams.is_empty() {
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
            Some("a_mixed".to_string())
        } else {
            None
        };

        if let Some(ref audio_in) = final_audio_label {
            if !speed_clips.is_empty() {
                // Construct audio segments
                let mut current_time = 0.0;
                let mut segments = Vec::new();

                for clip in &speed_clips {
                    if clip.timeline_in > current_time {
                        segments.push((current_time, Some(clip.timeline_in), 1.0));
                    }
                    segments.push((
                        clip.timeline_in,
                        Some(clip.timeline_out),
                        clip.speed_factor as f64,
                    ));
                    current_time = clip.timeline_out;
                }

                // Add final segment to end of video
                segments.push((current_time, None, 1.0));

                // Compile each segment
                let mut segment_labels = Vec::new();
                for (idx, (start, end, speed)) in segments.iter().enumerate() {
                    let label = format!("a_seg_{}", idx);

                    let mut trim_str = format!("atrim=start={:.3}", start);
                    if let Some(e) = end {
                        trim_str.push_str(&format!(":end={:.3}", e));
                    }
                    trim_str.push_str(",asetpts=PTS-STARTPTS");

                    let tempo_filter = audio::tempo::TempoFilter { speed: *speed };
                    let tempo_str = tempo_filter.compile();
                    let filter_str = if !tempo_str.is_empty() {
                        format!("{},{}", trim_str, tempo_str)
                    } else {
                        trim_str
                    };

                    filter_steps.push(format!("[{}]{}[{}]", audio_in, filter_str, label));
                    segment_labels.push(label);
                }

                // Concat segments
                let concat_inputs = segment_labels
                    .iter()
                    .map(|l| format!("[{}]", l))
                    .collect::<Vec<String>>()
                    .join("");

                let speed_audio_out = "a_speed_mixed".to_string();
                filter_steps.push(format!(
                    "{}concat=n={}:v=0:a=1[{}]",
                    concat_inputs,
                    segment_labels.len(),
                    speed_audio_out
                ));

                final_audio_label = Some(speed_audio_out);
            }
        }

        let compiled_filtergraph = filter_steps.join("; ");
        Ok((
            input_paths,
            compiled_filtergraph,
            current_video_stream,
            final_audio_label,
        ))
    }
}

/// Helper function to check if a media file contains an audio stream using ffprobe
fn has_audio_stream(file_path: &str) -> bool {
    let output = std::process::Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=codec_name",
            "-of",
            "csv=p=0",
            file_path,
        ])
        .output();

    if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        !stdout.trim().is_empty()
    } else {
        false
    }
}
