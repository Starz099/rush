use crate::db::models::project::Project as DbProject;
use crate::models::TrackType;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct RenderTimeline {
    pub width: i32,
    pub height: i32,
    pub framerate: i32,
    pub duration_seconds: f32,
    pub tracks: Vec<RenderTrack>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenderTrack {
    pub id: String,
    pub name: String,
    pub track_type: TrackType,
    pub clips: Vec<RenderClip>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenderClip {
    pub id: String,
    pub asset_id: String,
    pub file_path: String,
    pub timeline_in: f64,
    pub timeline_out: f64,
    pub source_in: f64,
    pub source_out: f64,
    pub transform: Option<ClipTransform>,
    pub volume: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClipTransform {
    pub height: i32,
    pub width: i32,
    pub x: i32,
    pub y: i32,
}

impl RenderTimeline {
    pub fn from_project(project: &DbProject, conn: &Connection) -> Result<Self, String> {
        let mut render_tracks: Vec<RenderTrack> = Vec::new();
        let mut max_duration_seconds: f64 = 0.0;

        for track in &project.timeline_state.tracks {
            let mut render_clips = Vec::new();

            for clip in &track.clips {
                let timeline_in = clip.timeline_in as f64 / project.framerate as f64;
                let timeline_out = clip.timeline_out as f64 / project.framerate as f64;
                let source_in = clip.source_in as f64 / project.framerate as f64;
                let source_out = clip.source_out as f64 / project.framerate as f64;

                if timeline_out > max_duration_seconds {
                    max_duration_seconds = timeline_out;
                }

                let file_path: String = conn
                    .query_row(
                        "SELECT file_path FROM assets WHERE id = ?1",
                        [&clip.asset_id],
                        |row| row.get(0),
                    )
                    .map_err(|e| {
                        format!(
                            "Failed to find file path for asset {}: {}",
                            clip.asset_id, e
                        )
                    })?;

                let transform = clip.transform.as_ref().map(|t| ClipTransform {
                    width: (project.viewport_width as f32 * t.scale) as i32,
                    height: (project.viewport_height as f32 * t.scale) as i32,
                    x: t.x as i32,
                    y: t.y as i32,
                });

                render_clips.push(RenderClip {
                    id: clip.id.clone(),
                    asset_id: clip.asset_id.clone(),
                    file_path,
                    timeline_in,
                    timeline_out,
                    source_in,
                    source_out,
                    transform,
                    volume: 1.0, //TODO: take actual input for volume from frontend
                })
            }

            render_tracks.push(RenderTrack {
                id: track.id.clone(),
                name: track.name.clone(),
                track_type: track.track_type,
                clips: render_clips,
            });
        }

        Ok(Self {
            width: project.viewport_width,
            height: project.viewport_height,
            framerate: project.framerate,
            duration_seconds: max_duration_seconds as f32,
            tracks: render_tracks,
        })
    }
}
