use std::fs;
use tauri::State;

use crate::git;
use crate::models::crew::{Crew, CrewInfo, CrewStatus};
use crate::state::AppState;

#[tauri::command]
pub fn list_crews(rig_id: String, state: State<AppState>) -> Result<Vec<CrewInfo>, String> {
    let rigs = state.rigs.lock().unwrap();
    let rig = rigs
        .iter()
        .find(|r| r.id == rig_id)
        .ok_or_else(|| "Rig not found".to_string())?;
    let _rig_path = rig.path.clone();
    drop(rigs);

    let crews = state.crews.lock().unwrap();
    let crew_infos: Vec<CrewInfo> = crews
        .iter()
        .filter(|c| c.rig_id == rig_id && c.status == CrewStatus::Active)
        .map(|c| {
            let branch = git::get_current_branch(&c.path);
            let status = git::get_short_status(&c.path);
            let changed = git::get_changed_file_count(&c.path);
            c.to_info(branch, status, changed)
        })
        .collect();

    Ok(crew_infos)
}

#[tauri::command]
pub fn create_crew(
    rig_id: String,
    name: String,
    base_branch: String,
    state: State<AppState>,
) -> Result<CrewInfo, String> {
    let rigs = state.rigs.lock().unwrap();
    let rig = rigs
        .iter()
        .find(|r| r.id == rig_id)
        .ok_or_else(|| "Rig not found".to_string())?;
    let rig_path = rig.path.clone();
    drop(rigs);

    // Sanitize crew name for branch/path
    let slug: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
        .collect();
    let branch_name = format!("crew/{}", slug);

    // Worktree path: ~/.townui/worktrees/<rig_id>/<slug>
    let wt_dir = state.worktrees_dir().join(&rig_id);
    fs::create_dir_all(&wt_dir)
        .map_err(|e| format!("Failed to create worktree directory: {}", e))?;
    let wt_path = wt_dir.join(&slug);
    let wt_path_str = wt_path.to_string_lossy().to_string();

    // Check duplicate name
    {
        let crews = state.crews.lock().unwrap();
        if crews.iter().any(|c| {
            c.rig_id == rig_id && c.name == name && c.status == CrewStatus::Active
        }) {
            return Err(format!("A crew named '{}' already exists for this rig", name));
        }
    }

    git::create_worktree(&rig_path, &wt_path_str, &branch_name, &base_branch)?;

    let crew = Crew::new(rig_id, name, branch_name, wt_path_str.clone());
    let branch = git::get_current_branch(&wt_path_str);
    let status = git::get_short_status(&wt_path_str);
    let changed = git::get_changed_file_count(&wt_path_str);
    let info = crew.to_info(branch, status, changed);

    let mut crews = state.crews.lock().unwrap();
    crews.push(crew);
    state.save_crews(&crews);

    Ok(info)
}

#[tauri::command]
pub fn get_crew(id: String, state: State<AppState>) -> Result<CrewInfo, String> {
    let crews = state.crews.lock().unwrap();
    let crew = crews
        .iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Crew not found".to_string())?;

    let branch = git::get_current_branch(&crew.path);
    let status = git::get_short_status(&crew.path);
    let changed = git::get_changed_file_count(&crew.path);
    Ok(crew.to_info(branch, status, changed))
}

#[tauri::command]
pub fn delete_crew(id: String, state: State<AppState>) -> Result<(), String> {
    let mut crews = state.crews.lock().unwrap();
    let crew = crews
        .iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Crew not found".to_string())?;

    let crew_path = crew.path.clone();
    let rig_id = crew.rig_id.clone();

    // Find rig path for worktree removal
    let rigs = state.rigs.lock().unwrap();
    let rig = rigs
        .iter()
        .find(|r| r.id == rig_id)
        .ok_or_else(|| "Rig not found".to_string())?;
    let rig_path = rig.path.clone();
    drop(rigs);

    // Remove the git worktree
    git::remove_worktree(&rig_path, &crew_path)?;

    // Soft-delete: set status to Removed instead of removing from list
    if let Some(crew) = crews.iter_mut().find(|c| c.id == id) {
        crew.status = CrewStatus::Removed;
    }
    state.save_crews(&crews);

    Ok(())
}

#[tauri::command]
pub fn list_branches(rig_id: String, state: State<AppState>) -> Result<Vec<String>, String> {
    let rigs = state.rigs.lock().unwrap();
    let rig = rigs
        .iter()
        .find(|r| r.id == rig_id)
        .ok_or_else(|| "Rig not found".to_string())?;
    let path = rig.path.clone();
    drop(rigs);

    git::list_branches(&path)
}
