use crate::render::filters::AudioFilter;

pub struct TempoFilter {
    pub speed: f64,
}

impl AudioFilter for TempoFilter {
    fn compile(&self) -> String {
        let mut filters = Vec::new();
        let mut s = self.speed;
        while s > 2.0 {
            filters.push("atempo=2.0".to_string());
            s /= 2.0;
        }
        while s < 0.5 {
            filters.push("atempo=0.5".to_string());
            s /= 0.5;
        }
        if (s - 1.0).abs() > 0.001 {
            filters.push(format!("atempo={:.4}", s));
        }
        filters.join(",")
    }
}
