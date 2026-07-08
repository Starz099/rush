pub mod embeddings;
pub mod models;

use reqwest::Client;
use serde_json::{json, Value};

pub async fn call_llm_messages(
    messages: Vec<Value>,
    api_url: &str,
    api_key: &str,
    model: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let client = Client::new();

    println!(
        "[llm] Sending request to {} using model {} with {} messages...",
        api_url,
        model,
        messages.len()
    );

    let res = client
        .post(api_url)
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "messages": messages,
            "response_format": {
                "type": "json_object"
            }
        }))
        .send()
        .await?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res
            .text()
            .await
            .unwrap_or_else(|_| "Could not read response body".to_string());
        eprintln!(
            "[llm] API request failed with status: {}. Response: {}",
            status, err_text
        );
        return Err(format!(
            "API request failed with status: {}. Response: {}",
            status, err_text
        )
        .into());
    }

    let response: Value = res.json().await?;
    println!("[llm] API request succeeded.");

    let content = response["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("No content returned.")
        .to_string();

    println!("[llm] Clean Content: {}", content);

    Ok(content)
}
