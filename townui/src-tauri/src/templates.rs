use std::collections::HashMap;
use std::fs;

pub struct Template {
    pub name: String,
    pub description: String,
    pub content: String,
    pub is_builtin: bool,
}

pub fn get_builtin_templates() -> Vec<Template> {
    vec![
        Template {
            name: "implement_feature".to_string(),
            description: "Implement a new feature".to_string(),
            content: r#"You are working on the project "{{rig.name}}".
You are on branch "{{crew.branch}}" in the repo at "{{repo.root}}".

Task: {{task.title}}

Description:
{{task.description}}

Please implement this feature. Write clean, well-structured code that follows the existing codebase patterns.
After implementing, briefly summarize what you changed."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "fix_bug".to_string(),
            description: "Fix a bug".to_string(),
            content: r#"You are working on the project "{{rig.name}}".
You are on branch "{{crew.branch}}" in the repo at "{{repo.root}}".

Bug to fix: {{task.title}}

Description:
{{task.description}}

Please investigate and fix this bug. Explain the root cause before applying the fix.
Make sure the fix doesn't introduce regressions."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "write_tests".to_string(),
            description: "Write tests for existing code".to_string(),
            content: r#"You are working on the project "{{rig.name}}".
You are on branch "{{crew.branch}}" in the repo at "{{repo.root}}".

Task: {{task.title}}

Description:
{{task.description}}

Please write comprehensive tests. Cover edge cases, error conditions, and happy paths.
Follow the existing test patterns in the codebase."#.to_string(),
            is_builtin: true,
        },
        Template {
            name: "refactor".to_string(),
            description: "Refactor existing code".to_string(),
            content: r#"You are working on the project "{{rig.name}}".
You are on branch "{{crew.branch}}" in the repo at "{{repo.root}}".

Refactoring task: {{task.title}}

Description:
{{task.description}}

Please refactor the code as described. Ensure behavior is preserved — no functional changes unless explicitly requested.
Keep the code clean and well-organized."#.to_string(),
            is_builtin: true,
        },
    ]
}

pub fn render_template(
    template_content: &str,
    vars: &HashMap<String, String>,
) -> String {
    let mut result = template_content.to_string();
    for (key, value) in vars {
        result = result.replace(&format!("{{{{{}}}}}", key), value);
    }
    result
}

pub fn render_builtin_template(
    template_name: &str,
    task_title: &str,
    task_description: &str,
    rig_name: &str,
    crew_branch: &str,
    repo_root: &str,
) -> String {
    let templates = get_builtin_templates();
    let template = templates
        .iter()
        .find(|t| t.name == template_name)
        .map(|t| t.content.clone())
        .unwrap_or_else(|| format!("Task: {}\n\n{}", task_title, task_description));

    let mut vars = HashMap::new();
    vars.insert("task.title".to_string(), task_title.to_string());
    vars.insert("task.description".to_string(), task_description.to_string());
    vars.insert("rig.name".to_string(), rig_name.to_string());
    vars.insert("crew.branch".to_string(), crew_branch.to_string());
    vars.insert("repo.root".to_string(), repo_root.to_string());

    render_template(&template, &vars)
}

/// Extract all `{{var}}` variable names from a template string.
pub fn extract_variables(template_content: &str) -> Vec<String> {
    let mut vars = Vec::new();
    let bytes = template_content.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i + 3 < len {
        if bytes[i] == b'{' && bytes[i + 1] == b'{' {
            // Found opening {{
            let start = i + 2;
            if let Some(end_offset) = template_content[start..].find("}}") {
                let var_name = template_content[start..start + end_offset].trim();
                if !var_name.is_empty() && !vars.contains(&var_name.to_string()) {
                    vars.push(var_name.to_string());
                }
                i = start + end_offset + 2;
            } else {
                i += 2;
            }
        } else {
            i += 1;
        }
    }

    vars
}

/// Validate that all variables in the template are provided in the vars map.
/// Returns a list of missing variable names.
pub fn validate_variables(
    template_content: &str,
    vars: &HashMap<String, String>,
) -> Vec<String> {
    extract_variables(template_content)
        .into_iter()
        .filter(|v| !vars.contains_key(v))
        .collect()
}

pub fn load_custom_templates(templates_dir: &std::path::Path) -> Vec<Template> {
    let mut templates = Vec::new();
    if let Ok(entries) = fs::read_dir(templates_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "txt" || e == "md").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    let name = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    templates.push(Template {
                        name: name.clone(),
                        description: format!("Custom template: {}", name),
                        content,
                        is_builtin: false,
                    });
                }
            }
        }
    }
    templates
}
