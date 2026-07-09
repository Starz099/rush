use rush_db::models::asset::Asset;

pub fn format_assets(assets: &[Asset]) -> String {
    if assets.is_empty() {
        return "No assets available in this project.".to_string();
    }

    let mut output = String::new();
    for asset in assets {
        output.push_str(&format!(
            "- ID: '{}'\n  Name: {}\n  Type: {}\n  Duration: {} ms\n  Path: {}\n\n",
            asset.id,
            asset.name,
            asset.media_type,
            asset.duration_ms.unwrap_or(0),
            asset.file_path
        ));
    }
    output
}
