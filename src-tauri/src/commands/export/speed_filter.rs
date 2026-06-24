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
        if factor < 0.5 {
            factor = 0.5;
        } else if factor > 100.0 {
            factor = 100.0;
        }

        filter_parts.push(format!(
            "[1:a]atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS,atempo={:.3}[a{}]",
            start_sec, end_sec, factor, idx
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
