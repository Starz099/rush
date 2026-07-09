use instant_clip_tokenizer::Tokenizer;
use ort::{inputs, session::Session, value::Value};
use std::path::Path;

/// Generates the 512-dimension text embedding for a text query using the local quantized CLIP text ONNX model.
pub async fn get_text_embedding(
    app: &tauri::AppHandle,
    text_query: &str,
    app_data_dir: &Path,
) -> Result<Vec<f32>, String> {
    // 1. Ensure the local CLIP text model is downloaded
    let model_path = super::models::ensure_clip_text_model(app, app_data_dir).await?;

    // 2. Tokenize input text using instant-clip-tokenizer (OpenAI vocabulary)
    let tokenizer = Tokenizer::new();
    let mut tokens = Vec::new();
    tokens.push(tokenizer.start_of_text());
    tokenizer.encode(text_query, &mut tokens);
    tokens.push(tokenizer.end_of_text());

    // CLIP context length is strictly 77 tokens. Truncate if longer.
    if tokens.len() > 77 {
        tokens.truncate(77);
        tokens[76] = tokenizer.end_of_text();
    }

    // Build the input_ids buffer of size 77
    let mut input_ids_data = vec![0i64; 77];

    for (i, token) in tokens.iter().enumerate() {
        input_ids_data[i] = token.to_u16() as i64;
    }

    // 3. Initialize the ONNX session
    let mut session = Session::builder()
        .map_err(|e| format!("Failed to build Session: {}", e))?
        .commit_from_file(model_path)
        .map_err(|e| format!("Failed to load CLIP text model: {}", e))?;

    // 4. Construct the 2D input tensor of shape [1, 77]
    let input_ids = Value::from_array(
        ndarray::Array2::from_shape_vec((1, 77), input_ids_data)
            .map_err(|e| format!("Failed to create input_ids array: {}", e))?,
    )
    .map_err(|e| format!("Failed to create input_ids tensor: {}", e))?;

    // 5. Run ONNX inference
    let outputs = session
        .run(inputs![
            "input_ids" => input_ids
        ])
        .map_err(|e| format!("CLIP text model inference failed: {}", e))?;

    // Extract the "text_embeds" output tensor (512 projection)
    let output_value = outputs
        .get("text_embeds")
        .ok_or("Failed to get model output tensor 'text_embeds'")?;

    let binding = output_value
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Failed to extract text embeds tensor: {}", e))?;

    let embedding: Vec<f32> = binding.1.to_vec();

    Ok(embedding)
}
