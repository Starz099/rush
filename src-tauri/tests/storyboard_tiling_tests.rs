use app_lib::asset_processor::video::LumaGrid;
use image::{DynamicImage, GenericImage, ImageBuffer};
use std::fs;
use std::path::Path;
use std::process::Command;

// Helper function to stitch dynamic images side-by-side horizontally
fn stitch_images_horizontally(images: &[DynamicImage]) -> DynamicImage {
    let width = images[0].width();
    let height = images[0].height();
    let total_width = width * images.len() as u32;

    let mut canvas = DynamicImage::ImageRgb8(ImageBuffer::new(total_width, height));

    for (idx, img) in images.iter().enumerate() {
        let x_offset = idx as u32 * width;
        canvas.copy_from(img, x_offset, 0).unwrap();
    }

    canvas
}

#[test]
fn test_storyboard_generation_and_tiling() {
    let video_path = "C:\\Users\\Mayank\\Videos\\oto_demo.mp4";
    let output_dir = "C:\\Users\\Mayank\\Desktop\\rush\\storyboard_test_output";
    let temp_frames_dir = "C:\\Users\\Mayank\\Desktop\\rush\\temp_storyboard_frames";

    // Setup directories
    if Path::new(output_dir).exists() {
        let _ = fs::remove_dir_all(output_dir);
    }
    fs::create_dir_all(output_dir).unwrap();

    if Path::new(temp_frames_dir).exists() {
        let _ = fs::remove_dir_all(temp_frames_dir);
    }
    fs::create_dir_all(temp_frames_dir).unwrap();

    // Extract frames every 500ms (2 FPS) using FFmpeg
    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            video_path,
            "-vf",
            "fps=2", // 2 frames per second (500ms intervals)
            "-vsync",
            "vfr",
            format!("{}/frame_%04d.jpg", temp_frames_dir).as_str(),
        ])
        .status()
        .expect("Failed to execute FFmpeg");

    assert!(status.success(), "FFmpeg failed to extract frames");

    // Read extracted frames in order, apply LumaGrid rejection, and filter
    let mut paths: Vec<_> = fs::read_dir(temp_frames_dir)
        .unwrap()
        .map(|r| r.unwrap())
        .collect();
    paths.sort_by_key(|dir| dir.path());

    let mut kept_images: Vec<DynamicImage> = Vec::new();
    let mut last_grid: Option<LumaGrid> = None;

    for entry in paths {
        let img_path = entry.path();
        let img = image::open(&img_path).expect("Failed to open frame image");

        // Scale down to 8x8 using fast bilinear filtering (just like the GPU does)
        let thumbnail = img.resize_exact(8, 8, image::imageops::FilterType::Triangle);
        let rgb_thumb = thumbnail.to_rgb8();

        // Calculate 8x8 luminance grid
        let mut cells = [0.0f32; 64];
        for y in 0..8 {
            for x in 0..8 {
                let pixel = rgb_thumb.get_pixel(x, y);
                let r = pixel[0] as f32;
                let g = pixel[1] as f32;
                let b = pixel[2] as f32;
                cells[(y * 8 + x) as usize] = 0.299 * r + 0.587 * g + 0.114 * b;
            }
        }
        let current_grid = LumaGrid { cells };

        // Difference check (Replicate frontend rejection math)
        let mut should_keep = false;
        if let Some(ref last) = last_grid {
            let mut diff_sum = 0.0;
            for i in 0..64 {
                diff_sum += (current_grid.cells[i] - last.cells[i]).abs();
            }
            let mad = diff_sum / 64.0;
            if mad > 12.0 {
                should_keep = true;
            }
        } else {
            should_keep = true;
        }

        if should_keep {
            // Keep a scaled down copy of the frame for tiling (scale down to 320x180)
            let tile = img.thumbnail(320, 180);
            kept_images.push(tile);
            last_grid = Some(current_grid);
        }
    }

    // Cleanup temp frames folder
    let _ = fs::remove_dir_all(temp_frames_dir);

    assert!(!kept_images.is_empty(), "No keyframes were kept!");
    println!(
        "Total keyframes kept after LumaGrid filtering: {}",
        kept_images.len()
    );

    // Stitch kept frames side-by-side
    let storyboard = stitch_images_horizontally(&kept_images);

    // Save tiled storyboard to folder in project root
    let save_path = format!("{}/storyboard.jpg", output_dir);
    storyboard
        .save(&save_path)
        .expect("Failed to save storyboard image");

    println!("Storyboard successfully saved to: {}", save_path);
}
