use crate::render::filters::VideoFilter;

/// OverlayFilter: Positions the video at (x,y) during its timeline interval
pub struct OverlayFilter {
    pub x: i32,
    pub y: i32,
    pub start_time: f64,
    pub end_time: f64,
}

impl VideoFilter for OverlayFilter {
    fn compile(&self) -> String {
        format!(
            "overlay=x={}:y={}:enable='between(t,{:.3},{:.3})'",
            self.x, self.y, self.start_time, self.end_time
        )
    }
}
