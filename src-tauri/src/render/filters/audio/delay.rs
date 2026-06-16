use crate::render::filters::AudioFilter;

pub struct DelayFilter {
    pub delay_ms: i64,
}

impl AudioFilter for DelayFilter {
    fn compile(&self) -> String {
        format!("adelay={0}|{0}", self.delay_ms)
    }
}
