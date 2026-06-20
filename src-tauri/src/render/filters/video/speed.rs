use crate::render::filters::VideoFilter;

pub struct SpeedFilter {
    pub t_in: f64,
    pub t_out: f64,
    pub speed_factor: f64,
}

impl VideoFilter for SpeedFilter {
    fn compile(&self) -> String {
        format!(
            "setpts='if(lt(T,{:.3}),T,if(lte(T,{:.3}),{:.3}+(T-{:.3})/{:.4},T-({:.3}-{:.3})*(1.0-1.0/{:.4})))'",
            self.t_in,
            self.t_out,
            self.t_in,
            self.t_in,
            self.speed_factor,
            self.t_out,
            self.t_in,
            self.speed_factor
        )
    }
}
