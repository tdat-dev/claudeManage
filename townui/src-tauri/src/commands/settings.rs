use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use tauri::State;

use crate::models::settings::AppSettings;
use crate::state::AppState;

/// Windows: CREATE_NO_WINDOW flag
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn normalize_settings(mut settings: AppSettings) -> AppSettings {
    let defaults = AppSettings::default();

    // Keep user overrides, but backfill any missing known CLI keys.
    for (key, value) in defaults.cli_paths {
        settings.cli_paths.entry(key).or_insert(value);
    }

    if settings.default_template.trim().is_empty() {
        settings.default_template = defaults.default_template;
    }

    if settings.default_cli.trim().is_empty() || !settings.cli_paths.contains_key(&settings.default_cli) {
        settings.default_cli = defaults.default_cli;
    }

    if settings.language.trim().is_empty() {
        settings.language = defaults.language;
    }

    if settings.ai_inbox_bridge.bind_addr.trim().is_empty() {
        settings.ai_inbox_bridge.bind_addr = defaults.ai_inbox_bridge.bind_addr;
    }
    if settings.ai_inbox_bridge.rate_limit_max_requests == 0 {
        settings.ai_inbox_bridge.rate_limit_max_requests =
            defaults.ai_inbox_bridge.rate_limit_max_requests;
    }
    if settings.ai_inbox_bridge.rate_limit_window_seconds == 0 {
        settings.ai_inbox_bridge.rate_limit_window_seconds =
            defaults.ai_inbox_bridge.rate_limit_window_seconds;
    }
    settings.ai_inbox_bridge.ip_allowlist = settings
        .ai_inbox_bridge
        .ip_allowlist
        .into_iter()
        .map(|ip| ip.trim().to_string())
        .filter(|ip| !ip.is_empty())
        .collect();

    settings
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> AppSettings {
    let mut current = state.settings.lock().unwrap();
    let normalized = normalize_settings(current.clone());
    *current = normalized.clone();
    state.save_settings(&current);
    normalized
}

#[tauri::command]
pub fn update_settings(settings: AppSettings, state: State<AppState>) {
    let settings = normalize_settings(settings);
    let mut current = state.settings.lock().unwrap();
    *current = settings.clone();
    state.save_settings(&current);
}

#[tauri::command]
pub fn validate_cli_path(path: String) -> Result<String, String> {
    // On Windows, CLI tools are often .cmd/.bat wrappers (npm-installed),
    // so we must go through cmd.exe /C to resolve them.
    #[cfg(target_os = "windows")]
    let output = {
        let mut c = Command::new("cmd");
        c.args(["/C", &path, "--version"]);
        c.creation_flags(CREATE_NO_WINDOW);
        c.output()
    };
    #[cfg(not(target_os = "windows"))]
    let output = Command::new(&path).arg("--version").output();

    let output = output.map_err(|e| format!("Cannot run '{}': {}", path, e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if version.is_empty() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Ok(if stderr.is_empty() { "OK (no version output)".to_string() } else { stderr })
        } else {
            Ok(version)
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("'{}' exited with error: {}", path, stderr))
    }
}
