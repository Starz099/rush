pub mod audio;
pub mod video;

pub trait VideoFilter {
    fn compile(&self) -> String;
}

pub trait AudioFilter {
    fn compile(&self) -> String;
}
