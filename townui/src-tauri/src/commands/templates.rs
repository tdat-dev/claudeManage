use std::collections::HashMap;
use tauri::State;
use serde::{Deserialize, Serialize};

use crate::state::AppState;
use crate::templates;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateInfo {
    pub name: String,
    pub description: String,
    pub content: String,
    pub is_builtin: bool,
}

#[tauri::command]
pub fn list_templates(state: State<AppState>) -> Vec<TemplateInfo> {
    let mut result: Vec<TemplateInfo> = templates::get_builtin_templates()
        .into_iter()
        .map(|t| TemplateInfo {
            name: t.name,
            description: t.description,
            content: t.content,
            is_builtin: t.is_builtin,
        })
        .collect();

    let custom = templates::load_custom_templates(&state.templates_dir());
    for t in custom {
        result.push(TemplateInfo {
            name: t.name,
            description: t.description,
            content: t.content,
            is_builtin: t.is_builtin,
        });
    }

    result
}

#[tauri::command]
pub fn render_template(
    name: String,
    vars: HashMap<String, String>,
    state: State<AppState>,
) -> Result<String, String> {
    // Find the template
    let all_templates = templates::get_builtin_templates();
    let custom = templates::load_custom_templates(&state.templates_dir());

    let template_content = all_templates
        .iter()
        .chain(custom.iter())
        .find(|t| t.name == name)
        .map(|t| t.content.clone())
        .ok_or_else(|| format!("Template '{}' not found", name))?;

    // Validate that all required variables are provided
    let missing = templates::validate_variables(&template_content, &vars);
    if !missing.is_empty() {
        return Err(format!(
            "Missing template variables: {}",
            missing.join(", ")
        ));
    }

    Ok(templates::render_template(&template_content, &vars))
}
