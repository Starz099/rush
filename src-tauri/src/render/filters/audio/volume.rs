use crate::render::filters::AudioFilter;

pub struct VolumeFilter {
    pub factor: f32,
}

impl AudioFilter for VolumeFilter {
    fn compile(&self) -> String {
        format!("volume={:.2}", self.factor)
    }
}
