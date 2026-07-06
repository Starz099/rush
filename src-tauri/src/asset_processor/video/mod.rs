use image::GenericImageView;
use rusqlite::Connection;
use std::fs;
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct LumaGrid {
    pub cells: [f32; 64],
}

impl LumaGrid {
    /// Computes the 8x8 LumaGrid from an image file path
    pub fn from_image_path<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let img =
            image::open(path).map_err(|e| format!("Failed to open image for LumaGrid: {}", e))?;
        Ok(Self::from_image(&img))
    }

    /// Computes the 8x8 LumaGrid from a DynamicImage by downsampling to 8x8
    /// and converting RGB to grayscale luminance (Y) using ITU-R BT.601
    pub fn from_image(img: &image::DynamicImage) -> Self {
        let resized = img.resize_exact(8, 8, image::imageops::FilterType::Triangle);
        let mut cells = [0.0; 64];

        for y in 0..8 {
            for x in 0..8 {
                let pixel = resized.get_pixel(x, y);
                let r = pixel[0] as f32;
                let g = pixel[1] as f32;
                let b = pixel[2] as f32;

                let luma = 0.299 * r + 0.587 * g + 0.114 * b;
                cells[(y * 8 + x) as usize] = luma;
            }
        }

        LumaGrid { cells }
    }

    /// Computes the Mean Absolute Difference (MAD) between this grid and another
    pub fn difference(&self, other: &Self) -> f32 {
        let mut sum = 0.0;
        for i in 0..64 {
            sum += (self.cells[i] - other.cells[i]).abs();
        }
        sum / 64.0
    }
}

/// Runs FFmpeg to extract frames, calculates LumaGrid changes,
/// saves keyframes to the database, and cleans up.
pub fn extract_visual_storyboard(
    input_path: &str,
    asset_id: &str,
    db_path: &Path,
) -> Result<(), String> {
    // Setup temporary directory for extracted frames
    let temp_dir = std::env::temp_dir().join(format!("lumagrid_{}", asset_id));
    if temp_dir.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
    }
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory for frames: {}", e))?;

    // Invoke FFmpeg to extract 1 frame every 2 seconds as a JPEG
    let mut cmd = crate::commands::process_helper::create_ffmpeg_command();
    let frame_pattern = temp_dir.join("frame_%04d.jpg");
    let frame_pattern_str = frame_pattern.to_str().ok_or("Invalid temp frame path")?;

    let status = cmd
        .args(&["-y", "-i", input_path, "-vf", "fps=0.5", frame_pattern_str])
        .status()
        .map_err(|e| format!("FFmpeg failed to start visual sampling: {}", e))?;

    if !status.success() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("FFmpeg exited with error status during visual sampling".into());
    }

    // Read the extracted frames and sort them alphabetically
    let mut paths: Vec<_> = fs::read_dir(&temp_dir)
        .map_err(|e| format!("Failed to read frame directory: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map_or(false, |ext| ext == "jpg"))
        .collect();

    paths.sort();

    // Connect to the SQLite Database and start a transaction
    let mut db =
        Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    let _ = db.execute("PRAGMA foreign_keys = ON;", []);

    let tx = db
        .transaction()
        .map_err(|e| format!("Failed to start database transaction: {}", e))?;

    let mut last_kept_grid: Option<LumaGrid> = None;

    // Iterate through sorted frames and compute difference
    for (idx, path) in paths.iter().enumerate() {
        let grid = LumaGrid::from_image_path(path)?;

        // Map frame index linearly to timestamp: each index represents 2 seconds (2000ms)
        let timestamp_ms = (idx as i64) * 2000;

        let (is_cut, motion_score) = match &last_kept_grid {
            None => {
                // Keep the first frame as the baseline shot
                last_kept_grid = Some(grid);
                (1, 0.0)
            }
            Some(last_grid) => {
                let diff = grid.difference(last_grid);
                if diff > 12.0 {
                    last_kept_grid = Some(grid); // Update reference to this new cut frame
                    (1, diff)
                } else {
                    (0, diff)
                }
            }
        };

        // If it is a scene cut/keyframe, insert it into SQLite
        if is_cut == 1 {
            let id = Uuid::new_v4().to_string();
            let description = format!("Storyboard keyframe at {}ms", timestamp_ms);

            tx.execute(
                "INSERT INTO asset_storyboards (id, asset_id, timestamp_ms, description, motion_score, is_cut)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                (
                    &id,
                    asset_id,
                    &timestamp_ms,
                    &Some(description),
                    &motion_score,
                    &is_cut,
                ),
            )
            .map_err(|e| format!("Failed to insert storyboard keyframe: {}", e))?;
        }
    }

    // Commit transaction & cleanup files
    tx.commit()
        .map_err(|e| format!("Failed to commit storyboard transaction: {}", e))?;

    let _ = fs::remove_dir_all(&temp_dir);

    Ok(())
}
