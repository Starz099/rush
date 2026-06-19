use crate::render::filters::VideoFilter;

pub struct TrimFilter {
    pub start: f64,
    pub end: f64,
    pub timeline_in: f64,
}

impl VideoFilter for TrimFilter {
    fn compile(&self) -> String {
        format!(
            "trim=start={:.3}:end={:.3},setpts=PTS-STARTPTS+{:.3}",
            self.start, self.end, self.timeline_in
        )
    }
}
