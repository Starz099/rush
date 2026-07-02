pub mod config;
use serde_json::{json, Value};

use reqwest::Client;

#[tokio::main]
async fn call_llm() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();

    let response: Value = client
        .post(config::API_URL)
        .bearer_auth(config::API_KEY)
        .json(&json!({
            "model": config::MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": "Hello!"
                }
            ]
        }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    println!("[llm]:  {}", serde_json::to_string_pretty(&response)?);

    Ok(())
}
