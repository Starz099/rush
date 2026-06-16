pub mod executor;
pub mod filtergraph;
pub mod filters;
pub mod models;

use executor::run_render;
use filtergraph::TimelineCompiler;
use models::RenderTimeline;
use tauri::AppHandle;

pub struct RenderEngine {
    timeline: RenderTimeline,
}

impl RenderEngine {
    pub fn new(timeline: RenderTimeline) -> Self {
        Self { timeline }
    }

    pub fn start_render(self, app_handle: &AppHandle, output_path: &str) -> Result<(), String> {
        let duration = self.timeline.duration_seconds;
        let compiler = TimelineCompiler::new(self.timeline);
        let (inputs, filter_graph, video_label, audio_label) = compiler.compile()?;

        run_render(
            app_handle,
            inputs,
            filter_graph,
            video_label,
            audio_label,
            output_path.to_string(),
            duration,
        )
    }
}
