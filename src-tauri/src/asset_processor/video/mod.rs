use image::GenericImageView;
use ort::{inputs, session::Session, value::Value};
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
/// computes CLIP vector embeddings for scene cuts, saves both metadata
/// and embeddings to the database, and cleans up.
pub fn extract_visual_storyboard(
    input_path: &str,
    asset_id: &str,
    db_path: &Path,
    clip_model_path: &Path,
) -> Result<(), String> {
    // Initialize the ONNX runtime session once
    let mut session = Session::builder()
        .map_err(|e| format!("Failed to create builder: {}", e))?
        .commit_from_file(clip_model_path)
        .map_err(|e| format!("Failed to load CLIP ONNX model: {}", e))?;

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

        // If it is a scene cut/keyframe, compute visual embedding and insert both
        if is_cut == 1 {
            let id = Uuid::new_v4().to_string();
            let description = format!("Storyboard keyframe at {}ms", timestamp_ms);

            // Insert keyframe metadata into relational table
            tx.execute(
                "INSERT INTO asset_storyboards (id, asset_id, timestamp_ms, description,
  motion_score, is_cut)
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

            // Compute the 512-dimension visual embedding using our ONNX session
            let embedding = compute_image_embedding(path, &mut session)?;

            // Convert the f32 vector into a little-endian byte blob (2048 bytes)
            let mut byte_blob = Vec::with_capacity(512 * 4);
            for &val in &embedding {
                byte_blob.extend_from_slice(&val.to_le_bytes());
            }

            // Insert embedding into the sqlite-vec virtual table
            tx.execute(
                "INSERT INTO asset_embeddings (embedding, storyboard_id) VALUES (?1, ?2)",
                (&byte_blob, &id),
            )
            .map_err(|e| format!("Failed to insert visual embedding: {}", e))?;
        }
    }

    // Commit transaction & cleanup files
    tx.commit()
        .map_err(|e| format!("Failed to commit storyboard transaction: {}", e))?;

    let _ = fs::remove_dir_all(&temp_dir);

    Ok(())
}

/// Computes the 512-dimension visual embedding for a JPEG frame using the local ONNX model
pub fn compute_image_embedding(
    image_path: &Path,
    session: &mut Session,
) -> Result<Vec<f32>, String> {
    // Load image and resize to 224x224
    let img = image::open(image_path)
        .map_err(|e| format!("Failed to open image for embedding: {}", e))?;
    let resized = img.resize_exact(224, 224, image::imageops::FilterType::Triangle);

    // Preprocess pixels into a planar [1, 3, 224, 224] float array
    let mut tensor_data = vec![0.0f32; 1 * 3 * 224 * 224];

    // Normalization constants for CLIP
    let mean = [0.48145466, 0.4578275, 0.40821073];
    let std = [0.26862954, 0.26130258, 0.2757771];

    for y in 0..224 {
        for x in 0..224 {
            let pixel = resized.get_pixel(x, y);

            let r = (pixel[0] as f32 / 255.0 - mean[0]) / std[0];
            let g = (pixel[1] as f32 / 255.0 - mean[1]) / std[1];
            let b = (pixel[2] as f32 / 255.0 - mean[2]) / std[2];

            // Planar indexing: RRR... GGG... BBB...
            let idx = (y * 224 + x) as usize;
            tensor_data[idx] = r;
            tensor_data[224 * 224 + idx] = g;
            tensor_data[2 * 224 * 224 + idx] = b;
        }
    }

    // Create input tensor matching shape [1, 3, 224, 224]
    let input_tensor = Value::from_array(
        ndarray::Array4::from_shape_vec((1, 3, 224, 224), tensor_data)
            .map_err(|e| format!("Failed to build tensor: {}", e))?,
    )
    .map_err(|e| format!("Failed to create input value: {}", e))?;

    // Run model inference (input name is "pixel_values")
    let outputs = session
        .run(inputs!["pixel_values" => input_tensor])
        .map_err(|e| format!("ONNX model execution failed: {}", e))?;

    // Extract the "image_embeds" output tensor (index 0)
    let output_value = outputs
        .get("image_embeds")
        .ok_or("Failed to get model output tensor 'image_embeds'")?;

    let binding = output_value
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Failed to extract output tensor: {}", e))?;

    let embedding: Vec<f32> = binding.1.to_vec();

    Ok(embedding)
}
