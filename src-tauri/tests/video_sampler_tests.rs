use app_lib::asset_processor::video::LumaGrid;
use std::fs;
use std::path::Path;

#[tokio::test]
async fn test_run_video_sampler_manually() {
    let input_path = r"C:\Users\Mayank\Downloads\testing-transcription.mp4";
    let storyboard_output_dir = Path::new(r"C:\Users\Mayank\Desktop\rush\storyboard_output");

    if !Path::new(input_path).exists() {
        println!("Test media file does not exist at: {}", input_path);
        return;
    }

    // Prepare a clean output directory in the workspace root
    if storyboard_output_dir.exists() {
        let _ = fs::remove_dir_all(storyboard_output_dir);
    }
    fs::create_dir_all(storyboard_output_dir).unwrap();

    // Create a temporary directory for extraction
    let temp_dir = std::env::temp_dir().join("test_lumagrid_extraction");
    if temp_dir.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
    }
    fs::create_dir_all(&temp_dir).unwrap();

    // Extract frames using the same FFmpeg process helper
    let mut cmd = app_lib::commands::process_helper::create_ffmpeg_command();
    let frame_pattern = temp_dir.join("frame_%04d.jpg");
    let frame_pattern_str = frame_pattern.to_str().unwrap();

    let status = cmd
        .args(&["-y", "-i", input_path, "-vf", "fps=0.5", frame_pattern_str])
        .status()
        .unwrap();

    assert!(status.success(), "FFmpeg failed to extract frames");

    // Gather and sort the extracted JPEGs
    let mut paths: Vec<_> = fs::read_dir(&temp_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map_or(false, |ext| ext == "jpg"))
        .collect();

    paths.sort();

    let mut last_kept_grid: Option<LumaGrid> = None;

    // Run LumaGrid difference math and copy selected keyframes
    for (idx, path) in paths.iter().enumerate() {
        let grid = LumaGrid::from_image_path(path).unwrap();
        let timestamp_ms = (idx as i64) * 2000;

        let (is_cut, motion_score) = match &last_kept_grid {
            None => {
                last_kept_grid = Some(grid);
                (true, 0.0)
            }
            Some(last_grid) => {
                let diff = grid.difference(last_grid);
                if diff > 12.0 {
                    last_kept_grid = Some(grid);
                    (true, diff)
                } else {
                    (false, diff)
                }
            }
        };

        if is_cut {
            let dest_filename = format!("keyframe_{}ms.jpg", timestamp_ms);
            let dest_path = storyboard_output_dir.join(&dest_filename);
            fs::copy(path, &dest_path).unwrap();
            println!(
                "SAVED KEYFRAME -> Time: {}ms, Diff Score: {:.2} (File: {})",
                timestamp_ms, motion_score, dest_filename
            );
        } else {
            println!(
                "DISCARDED -> Time: {}ms, Diff Score: {:.2}",
                timestamp_ms, motion_score
            );
        }
    }

    // Clean up temporary files
    let _ = fs::remove_dir_all(&temp_dir);
    println!(
        "Test complete. Saved keyframes to {:?}",
        storyboard_output_dir
    );
}
