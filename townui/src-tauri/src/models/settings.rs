use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub cli_paths: std::collections::HashMap<String, String>,
    pub env_vars: std::collections::HashMap<String, String>,
    pub default_template: String,
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_language() -> String {
    "en".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        let mut cli_paths = std::collections::HashMap::new();

        // ── Anthropic ──
        cli_paths.insert("claude".to_string(), "claude".to_string());

        // ── OpenAI ──
        cli_paths.insert("codex".to_string(), "codex".to_string());
        cli_paths.insert("chatgpt".to_string(), "chatgpt".to_string());

        // ── Google ──
        cli_paths.insert("gemini".to_string(), "gemini".to_string());

        // ── GitHub ──
        cli_paths.insert("copilot".to_string(), "gh".to_string());

        // ── Amazon ──
        cli_paths.insert("amazon-q".to_string(), "q".to_string());

        // ── Open-source agents ──
        cli_paths.insert("aider".to_string(), "aider".to_string());
        cli_paths.insert("goose".to_string(), "goose".to_string());
        cli_paths.insert("openhands".to_string(), "openhands".to_string());
        cli_paths.insert("swe-agent".to_string(), "swe-agent".to_string());
        cli_paths.insert("mentat".to_string(), "mentat".to_string());
        cli_paths.insert("gpt-engineer".to_string(), "gpte".to_string());
        cli_paths.insert("cline".to_string(), "cline".to_string());
        cli_paths.insert("continue".to_string(), "continue".to_string());
        cli_paths.insert("tabby".to_string(), "tabby".to_string());
        cli_paths.insert("roo".to_string(), "roo".to_string());
        cli_paths.insert("sweep".to_string(), "sweep".to_string());
        cli_paths.insert("auto-coder".to_string(), "auto-coder".to_string());

        // ── IDE-based agents (CLI mode) ──
        cli_paths.insert("cursor".to_string(), "cursor".to_string());
        cli_paths.insert("windsurf".to_string(), "windsurf".to_string());
        cli_paths.insert("trae".to_string(), "trae".to_string());
        cli_paths.insert("augment".to_string(), "augment".to_string());
        cli_paths.insert("pear".to_string(), "pear".to_string());
        cli_paths.insert("void".to_string(), "void".to_string());

        // ── Sourcegraph ──
        cli_paths.insert("cody".to_string(), "cody".to_string());

        // ── Other coding assistants ──
        cli_paths.insert("tabnine".to_string(), "tabnine".to_string());
        cli_paths.insert("supermaven".to_string(), "supermaven".to_string());
        cli_paths.insert("codestory".to_string(), "codestory".to_string());
        cli_paths.insert("double".to_string(), "double".to_string());
        cli_paths.insert("devin".to_string(), "devin".to_string());
        cli_paths.insert("replit".to_string(), "replit".to_string());
        cli_paths.insert("bolt".to_string(), "bolt".to_string());

        // ── Custom command (passthrough) ──
        cli_paths.insert("custom".to_string(), "".to_string());

        Self {
            cli_paths,
            env_vars: std::collections::HashMap::new(),
            default_template: "implement_feature".to_string(),
            language: default_language(),
        }
    }
}
