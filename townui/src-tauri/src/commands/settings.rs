use std::process::Command;
use tauri::State;

use crate::models::settings::AppSettings;
use crate::state::AppState;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_settings(settings: AppSettings, state: State<AppState>) {
    let mut current = state.settings.lock().unwrap();
    *current = settings.clone();
    state.save_settings(&current);
}

#[tauri::command]
pub fn validate_cli_path(path: String) -> Result<String, String> {
    let output = Command::new(&path)
        .arg("--version")
        .output()
        .map_err(|e| format!("Cannot run '{}': {}", path, e))?;

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
