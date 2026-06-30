use crate::models::TrackType;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(tag = "type", content = "params", rename_all = "snake_case")]
pub enum BackgroundSource {
    Solid {
        color_hex: String,
    },
    Gradient {
        gradient_type: String,
        colors: Vec<String>,
        angle_degrees: Option<f32>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum TransitionType {
    Fade,
    Slide,
    Wipe,
    Zoom,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum EaseCurve {
    Linear,
    EaseIn,
    EaseOut,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum Shape {
    Circle,
    Rectangle,
    Arrow,
    Highlighter,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[serde(tag = "type", content = "params", rename_all = "snake_case")]
pub enum EffectConfig {
    Zoom {
        start_scale: f32,
        end_scale: f32,
        center_x: f32,
        center_y: f32,
        ease_curve: EaseCurve,
    },
    Highlight {
        shape: Shape,
        color_hex: String,
        stroke_width: i32,
        animation: String,
    },
    TextOverlay {
        text: String,
        font_family: String,
        font_size: i32,
        color_hex: String,
    },
}

fn default_speed_factor() -> f32 {
    1.0
}

fn default_blur_value() -> u32 {
    0
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct BackgroundConfig {
    pub source: BackgroundSource,
    #[serde(default = "default_blur_value")]
    pub blur_value: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Transition {
    pub id: String,
    pub from_clip_id: String,
    pub to_clip_id: String,
    pub transition_type: TransitionType,
    pub duration_frames: i32,
    pub ease_curve: EaseCurve,
}

pub fn default_background() -> BackgroundConfig {
    BackgroundConfig {
        source: BackgroundSource::Solid {
            color_hex: "#000000".to_string(),
        },
        blur_value: 0,
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct TimelineState {
    pub playhead_position: i32,
    pub tracks: Vec<Track>,
    #[serde(default)]
    pub background: Option<BackgroundConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Track {
    pub id: String,
    pub name: String,
    pub track_type: TrackType,
    pub clips: Vec<Clip>,
    #[serde(default)]
    pub transitions: Vec<Transition>,
    #[serde(default)]
    pub is_muted: bool,
    #[serde(default)]
    pub is_locked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Transform {
    pub x: f32,
    pub y: f32,
    pub scale: f32,
    pub z_index: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Clip {
    pub id: String,
    pub asset_id: Option<String>,
    pub timeline_in: i32,
    pub timeline_out: i32,
    pub source_in: i32,
    pub source_out: i32,
    pub transform: Option<Transform>,
    #[serde(default = "default_speed_factor")]
    pub speed_factor: f32,
    #[serde(default)]
    pub effects: Vec<EffectConfig>,
}

impl Clip {
    pub fn is_gap(&self, track_type: TrackType) -> bool {
        match track_type {
            TrackType::Video | TrackType::Audio => self.asset_id.is_none(),
            TrackType::Effects => {
                self.asset_id.is_none()
                    && self.transform.is_none()
                    && self.speed_factor == 1.0
                    && self.effects.is_empty()
            }
        }
    }
}

impl Track {
    pub fn validate_and_sort_clips(&mut self) {
        if self.clips.is_empty() {
            return;
        }

        let track_type = self.track_type;

        // 1. Separate clips into media (non-gap) and gap clips
        let mut media_clips = Vec::new();
        let mut gap_clips = Vec::new();

        for clip in self.clips.drain(..) {
            if clip.is_gap(track_type) {
                gap_clips.push(clip);
            } else {
                media_clips.push(clip);
            }
        }

        // Sort media clips by timeline_in, then timeline_out
        media_clips.sort_by(|a, b| {
            a.timeline_in
                .cmp(&b.timeline_in)
                .then(a.timeline_out.cmp(&b.timeline_out))
        });

        let mut validated = Vec::new();
        let mut current_time = 0;

        // If there are no media clips, but we have gap clips, preserve the first gap
        if media_clips.is_empty() && !gap_clips.is_empty() {
            let mut gap_clip = gap_clips.remove(0);
            let duration = gap_clip.timeline_out - gap_clip.timeline_in;
            if duration > 0 {
                gap_clip.transform = None;
                gap_clip.effects = Vec::new();
                gap_clip.speed_factor = 1.0;
                gap_clip.asset_id = None;
                gap_clip.timeline_in = 0;
                gap_clip.timeline_out = duration;
                validated.push(gap_clip);
            }
        }

        for mut clip in media_clips {
            let duration = clip.timeline_out - clip.timeline_in;
            if duration <= 0 {
                continue;
            }

            if clip.timeline_in > current_time {
                let gap_duration = clip.timeline_in - current_time;
                let gap_space_start = current_time;
                let gap_space_end = clip.timeline_in;

                // Find if there is an existing gap clip that intersects with the gap space [current_time, clip.timeline_in]
                let existing_gap_index = gap_clips.iter().position(|g| {
                    let start = g.timeline_in.max(gap_space_start);
                    let end = g.timeline_out.min(gap_space_end);
                    start < end
                });

                let mut gap_clip = if let Some(idx) = existing_gap_index {
                    gap_clips.remove(idx)
                } else {
                    Clip {
                        id: uuid::Uuid::new_v4().to_string(),
                        asset_id: None,
                        timeline_in: current_time,
                        timeline_out: current_time + gap_duration,
                        source_in: 0,
                        source_out: gap_duration,
                        transform: None,
                        speed_factor: 1.0,
                        effects: Vec::new(),
                    }
                };

                // Enforce gap constraints
                gap_clip.transform = None;
                gap_clip.effects = Vec::new();
                gap_clip.speed_factor = 1.0;
                gap_clip.asset_id = None;
                gap_clip.timeline_in = current_time;
                gap_clip.timeline_out = current_time + gap_duration;
                gap_clip.source_in = 0;
                gap_clip.source_out = gap_duration;

                validated.push(gap_clip);
                current_time = clip.timeline_in;
            }

            // Place the media / effect clip (resolving overlaps by shifting it to current_time)
            clip.timeline_in = current_time;
            clip.timeline_out = current_time + duration;
            current_time = clip.timeline_out;
            validated.push(clip);
        }

        self.clips = validated;
    }
}
