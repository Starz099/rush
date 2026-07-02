use crate::agent::ai::call_llm;

pub async fn run_planner(session_id: String, prompt: String) -> Result<String, String> {
    // Implement the logic to run the planner with the given session_id and prompt
    // For now, we will return a placeholder response

    let result = call_llm(prompt.clone()).await.map_err(|e| e.to_string())?;

    Ok(result)
}
