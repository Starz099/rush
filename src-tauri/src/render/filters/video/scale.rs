use crate::render::filters::VideoFilter;

/// ScaleFilter: Scales the video to calculated dimensions
pub struct ScaleFilter {
    pub width: i32,
    pub height: i32,
}

impl VideoFilter for ScaleFilter {
    fn compile(&self) -> String {
        format!("scale={}:{}", self.width, self.height)
    }
}
