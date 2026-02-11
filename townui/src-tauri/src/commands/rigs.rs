use std::path::Path;
use tauri::State;

use crate::git;
use crate::models::rig::{Rig, RigInfo};
use crate::state::AppState;

#[tauri::command]
pub fn list_rigs(state: State<AppState>) -> Vec<RigInfo> {
    let rigs = state.rigs.lock().unwrap();
    rigs.iter()
        .map(|r| {
            let is_git = git::is_git_repo(&r.path);
            let branch = if is_git { git::get_current_branch(&r.path) } else { None };
            let status = if is_git { git::get_short_status(&r.path) } else { None };
            r.to_info(branch, status, is_git)
        })
        .collect()
}

#[tauri::command]
pub fn create_rig(path: String, state: State<AppState>) -> Result<RigInfo, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }
    if !p.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let is_git = git::is_git_repo(&path);
    if !is_git {
        return Err("Selected folder is not a git repository. Please select a folder containing a .git directory.".to_string());
    }

    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let rig = Rig::new(name, path.clone());

    let mut rigs = state.rigs.lock().unwrap();

    // Check for duplicate path
    if rigs.iter().any(|r| r.path == path) {
        return Err("A rig with this path already exists".to_string());
    }

    let branch = git::get_current_branch(&path);
    let status = git::get_short_status(&path);
    let info = rig.to_info(branch, status, true);

    rigs.push(rig);
    state.save_rigs(&rigs);

    Ok(info)
}

#[tauri::command]
pub fn get_rig(id: String, state: State<AppState>) -> Result<RigInfo, String> {
    let mut rigs = state.rigs.lock().unwrap();
    let rig = rigs
        .iter_mut()
        .find(|r| r.id == id)
        .ok_or_else(|| "Rig not found".to_string())?;

    // Update last_opened
    rig.last_opened = chrono::Utc::now().to_rfc3339();
    let path = rig.path.clone();

    state.save_rigs(&rigs);

    let is_git = git::is_git_repo(&path);
    let branch = if is_git { git::get_current_branch(&path) } else { None };
    let status = if is_git { git::get_short_status(&path) } else { None };

    let rig = rigs
        .iter()
        .find(|r| r.id == id)
        .ok_or_else(|| "Rig not found".to_string())?;

    Ok(rig.to_info(branch, status, is_git))
}

#[tauri::command]
pub fn delete_rig(id: String, state: State<AppState>) -> Result<(), String> {
    let mut rigs = state.rigs.lock().unwrap();
    let len_before = rigs.len();
    rigs.retain(|r| r.id != id);

    if rigs.len() == len_before {
        return Err("Rig not found".to_string());
    }

    state.save_rigs(&rigs);
    Ok(())
}
