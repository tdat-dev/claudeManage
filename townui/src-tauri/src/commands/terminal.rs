use std::process::Command;
use std::time::Instant;

use serde::Serialize;
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct TerminalCommandResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

#[tauri::command]
pub fn run_rig_command(
    rig_id: String,
    command: String,
    state: State<AppState>,
) -> Result<TerminalCommandResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    let rig_path = {
        let rigs = state.rigs.lock().unwrap();
        rigs.iter()
            .find(|r| r.id == rig_id)
            .map(|r| r.path.clone())
            .ok_or_else(|| "Rig not found".to_string())?
    };

    let started = Instant::now();

    #[cfg(target_os = "windows")]
    let output_result = Command::new("cmd")
        .args(["/C", trimmed])
        .current_dir(&rig_path)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output_result = Command::new("sh")
        .args(["-lc", trimmed])
        .current_dir(&rig_path)
        .output();

    let output = output_result.map_err(|error| format!("Failed to run command: {error}"))?;
    let elapsed_ms_u128 = started.elapsed().as_millis();
    let duration_ms = u64::try_from(elapsed_ms_u128).unwrap_or(u64::MAX);

    Ok(TerminalCommandResult {
        command: trimmed.to_string(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
        duration_ms,
    })
}
