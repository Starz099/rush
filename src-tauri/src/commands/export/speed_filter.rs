use crate::commands::export::types::SpeedBlock;

pub fn build_audio_speed_filter(
    speed_blocks: &[SpeedBlock],
    fps: u32,
    total_duration_secs: f64,
) -> String {
    if speed_blocks.is_empty() {
        return String::new();
    }

    let mut sorted_blocks = speed_blocks.to_vec();
    sorted_blocks.sort_by_key(|b| b.start_frame);

    let mut continuous_blocks = Vec::new();
    let mut current_frame = 0;

    for block in sorted_blocks {
        if block.start_frame > current_frame {
            continuous_blocks.push(SpeedBlock {
                start_frame: current_frame,
                end_frame: block.start_frame,
                factor: 1.0,
            });
        }
        continuous_blocks.push(block.clone());
        current_frame = block.end_frame;
    }

    let total_frames = (total_duration_secs * fps as f64).round() as u32;
    if current_frame < total_frames {
        continuous_blocks.push(SpeedBlock {
            start_frame: current_frame,
            end_frame: total_frames,
            factor: 1.0,
        });
    }

    let mut filter_parts = Vec::new();
    let mut concat_inputs = String::new();

    for (idx, block) in continuous_blocks.iter().enumerate() {
        let start_sec = block.start_frame as f64 / fps as f64;
        let end_sec = block.end_frame as f64 / fps as f64;

        let mut factor = block.factor;
        if factor < 0.1 {
            factor = 0.1;
        } else if factor > 100.0 {
            factor = 100.0;
        }

        // Chaining atempo filters since a single atempo is limited to [0.5, 2.0]
        let mut atempo_filters = Vec::new();
        let mut remaining_factor = factor;
        while remaining_factor > 2.0 {
            atempo_filters.push("atempo=2.0".to_string());
            remaining_factor /= 2.0;
        }
        while remaining_factor < 0.5 {
            atempo_filters.push("atempo=0.5".to_string());
            remaining_factor /= 0.5;
        }
        if (remaining_factor - 1.0).abs() > 0.001 {
            atempo_filters.push(format!("atempo={:.3}", remaining_factor));
        }

        let atempo_str = if atempo_filters.is_empty() {
            String::new()
        } else {
            format!(",{}", atempo_filters.join(","))
        };

        filter_parts.push(format!(
            "[1:a]atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS{}[a{}]",
            start_sec, end_sec, atempo_str, idx
        ));
        concat_inputs.push_str(&format!("[a{}]", idx));
    }

    if filter_parts.is_empty() {
        return String::new();
    }

    format!(
        "{}; {}concat=n={}:v=0:a=1[aout]",
        filter_parts.join("; "),
        concat_inputs,
        filter_parts.len()
    )
}
