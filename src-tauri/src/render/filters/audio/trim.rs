use crate::render::filters::AudioFilter;

pub struct TrimFilter {
    pub start: f64,
    pub end: f64,
}

impl AudioFilter for TrimFilter {
    fn compile(&self) -> String {
        format!(
            "atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS",
            self.start, self.end
        )
    }
}
