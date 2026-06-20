use crate::db::models::clip::{BackgroundConfig, BackgroundSource};
use crate::render::filters::VideoFilter;

pub struct BackgroundFilter {
    pub width: i32,
    pub height: i32,
    pub duration_seconds: f32,
    pub background: Option<BackgroundConfig>,
    pub framerate: i32,
}

fn format_ffmpeg_color(hex: &str) -> String {
    let clean = hex.trim_start_matches('#');
    format!("0x{}", clean)
}

impl VideoFilter for BackgroundFilter {
    fn compile(&self) -> String {
        let mut base_filter = if let Some(ref bg) = self.background {
            match &bg.source {
                BackgroundSource::Solid { color_hex } => {
                    let color = format_ffmpeg_color(color_hex);
                    format!(
                        "color=c={}:s={}x{}:d={}",
                        color, self.width, self.height, self.duration_seconds
                    )
                }
                BackgroundSource::Gradient {
                    gradient_type,
                    colors,
                    angle_degrees,
                } => {
                    let c0 = colors
                        .get(0)
                        .map(|c| format_ffmpeg_color(c))
                        .unwrap_or_else(|| "0x000000".to_string());
                    let c1 = colors
                        .get(1)
                        .map(|c| format_ffmpeg_color(c))
                        .unwrap_or_else(|| "0x000000".to_string());

                    if gradient_type == "linear" {
                        let angle = angle_degrees.unwrap_or(0.0);
                        let angle_rad = angle * std::f32::consts::PI / 180.0;

                        let dx = angle_rad.cos();
                        let dy = angle_rad.sin();

                        let cx = self.width as f32 / 2.0;
                        let cy = self.height as f32 / 2.0;
                        let r = ((self.width as f32).powi(2) + (self.height as f32).powi(2)).sqrt()
                            / 2.0;

                        let x0 = std::cmp::max(0, (cx - dx * r).round() as i32);
                        let y0 = std::cmp::max(0, (cy - dy * r).round() as i32);
                        let x1 = std::cmp::max(0, (cx + dx * r).round() as i32);
                        let y1 = std::cmp::max(0, (cy + dy * r).round() as i32);

                        format!(
                            "gradients=s={}x{}:d={}:c0={}:c1={}:x0={}:y0={}:x1={}:y1={}:speed=0",
                            self.width, self.height, self.duration_seconds, c0, c1, x0, y0, x1, y1
                        )
                    } else {
                        // Radial gradient source
                        format!(
                            "gradients=s={}x{}:d={}:c0={}:c1={}:type=radial:speed=0",
                            self.width, self.height, self.duration_seconds, c0, c1
                        )
                    }
                }
            }
        } else {
            // Default background fallback
            format!(
                "color=c=black:s={}x{}:d={}",
                self.width, self.height, self.duration_seconds
            )
        };

        // Append boxblur to the chain if blur_value is positive
        if let Some(ref bg) = self.background {
            if bg.blur_value > 0 {
                // Scale blur value to match the WebGPU shader viewport scaling (approx. 0.75x)
                let luma_radius = std::cmp::max(1, (bg.blur_value as f32 * 0.75).round() as u32);
                base_filter = format!(
                    "{},format=yuv420p,boxblur=luma_radius={}:luma_power=2",
                    base_filter, luma_radius
                );
            }
        }

        format!("{},fps=fps={}", base_filter, self.framerate)
    }
}
