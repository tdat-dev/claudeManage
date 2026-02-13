use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use tauri::State;

use crate::models::settings::AppSettings;
use crate::state::AppState;

/// Windows: CREATE_NO_WINDOW flag
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
