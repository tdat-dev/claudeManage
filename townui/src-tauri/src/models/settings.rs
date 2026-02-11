use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub cli_paths: std::collections::HashMap<String, String>,
    pub env_vars: std::collections::HashMap<String, String>,
    pub default_template: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        let mut cli_paths = std::collections::HashMap::new();
        cli_paths.insert("claude".to_string(), "claude".to_string());

        Self {
            cli_paths,
            env_vars: std::collections::HashMap::new(),
            default_template: "implement_feature".to_string(),
        }
    }
}
