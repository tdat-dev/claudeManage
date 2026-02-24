use std::fs;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::git;
use crate::models::crew::{Crew, CrewInfo, CrewStatus};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct CrewPreset {
    pub key: String,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub color: String,
}

#[tauri::command]
pub fn get_crew_presets() -> Vec<CrewPreset> {
    vec![
        CrewPreset {
            key: "architect".into(),
            name: "Architect".into(),
            icon: "🏗️".into(),
            description: "System design, architecture decisions, tech stack evaluation".into(),
            color: "#8B5CF6".into(),
        },
        CrewPreset {
            key: "frontend".into(),
            name: "Frontend".into(),
            icon: "🎨".into(),
            description: "UI/UX development, components, styling, responsiveness".into(),
            color: "#06B6D4".into(),
        },
        CrewPreset {
            key: "backend".into(),
            name: "Backend".into(),
            icon: "⚙️".into(),
            description: "API development, server logic, microservices, data processing".into(),
            color: "#10B981".into(),
        },
        CrewPreset {
            key: "devops".into(),
            name: "DevOps".into(),
            icon: "🚀".into(),
            description: "CI/CD pipelines, infrastructure, deployment, monitoring".into(),
            color: "#F59E0B".into(),
        },
        CrewPreset {
            key: "qa".into(),
            name: "QA".into(),
            icon: "🧪".into(),
            description: "Testing, quality assurance, test automation, coverage".into(),
            color: "#EF4444".into(),
        },
        CrewPreset {
            key: "security".into(),
            name: "Security".into(),
            icon: "🛡️".into(),
            description: "Security audits, vulnerability fixes, compliance, penetration testing".into(),
            color: "#DC2626".into(),
        },
        CrewPreset {
            key: "database".into(),
            name: "Database".into(),
            icon: "🗄️".into(),
            description: "Schema design, migrations, query optimization, data modeling".into(),
            color: "#7C3AED".into(),
        },
        CrewPreset {
            key: "docs".into(),
            name: "Documentation".into(),
            icon: "📚".into(),
            description: "Technical docs, API documentation, knowledge base, guides".into(),
            color: "#2563EB".into(),
        },
        CrewPreset {
            key: "performance".into(),
            name: "Performance".into(),
            icon: "⚡".into(),
            description: "Optimization, benchmarking, profiling, load testing".into(),
            color: "#EA580C".into(),
        },
        CrewPreset {
            key: "release".into(),
            name: "Release".into(),
            icon: "📦".into(),
            description: "Release management, versioning, changelogs, deployment coordination".into(),
            color: "#0D9488".into(),
        },
        CrewPreset {
            key: "hotfix".into(),
            name: "Hotfix".into(),
            icon: "🔥".into(),
            description: "Emergency bug fixes, production incidents, critical patches".into(),
            color: "#B91C1C".into(),
        },
        CrewPreset {
            key: "research".into(),
            name: "Research".into(),
            icon: "🔬".into(),
            description: "R&D, prototyping, technology evaluation, proof of concepts".into(),
            color: "#6366F1".into(),
        },
    ]
}

#[tauri::command]
pub async fn list_crews(rig_id: String, state: State<'_, AppState>) -> Result<Vec<CrewInfo>, String> {
    let rig_exists = {
        let rigs = state.rigs.lock().unwrap();
        rigs.iter().any(|r| r.id == rig_id)
    };
    if !rig_exists {
        return Err("Rig not found".to_string());
    }

    let crews = {
        let crews_guard = state.crews.lock().unwrap();
        crews_guard
            .iter()
            .filter(|c| c.rig_id == rig_id && c.status == CrewStatus::Active)
            .cloned()
            .collect::<Vec<_>>()
    };

    let mut handles = vec![];
    for c in crews {
        handles.push(tokio::task::spawn_blocking(move || {
            let branch = git::get_current_branch(&c.path);
            let (status, changed) = git::get_status_info(&c.path);
            c.to_info(branch, status, changed)
        }));
    }

    let mut results = vec![];
    for handle in handles {
        match handle.await {
            Ok(info) => results.push(info),
            Err(e) => return Err(format!("Task failed: {}", e)),
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn create_crew(
    rig_id: String,
    name: String,
    base_branch: String,
    push_to_remote: bool,
    state: State<AppState>,
    app: AppHandle,
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

    // Publish the new branch to remote if requested
    if push_to_remote {
        if let Err(e) = git::push_branch(&rig_path, &branch_name) {
            eprintln!("Warning: failed to push branch '{}' to remote: {}", branch_name, e);
        }
    }

    let crew = Crew::new(rig_id, name, branch_name, wt_path_str.clone());
    let branch = git::get_current_branch(&wt_path_str);
    let (status, changed) = git::get_status_info(&wt_path_str);
    let info = crew.to_info(branch, status, changed);

    let mut crews = state.crews.lock().unwrap();
    crews.push(crew);
    state.save_crews(&crews);

    let _ = app.emit("data-changed", "");
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
    let (status, changed) = git::get_status_info(&crew.path);
    Ok(crew.to_info(branch, status, changed))
}

#[tauri::command]
pub fn delete_crew(id: String, state: State<AppState>, app: AppHandle) -> Result<(), String> {
    // Step 1: Read crew data (lock crews, extract info, drop lock)
    let (crew_path, crew_branch, rig_id) = {
        let crews = state.crews.lock().unwrap_or_else(|e| e.into_inner());
        let crew = crews
            .iter()
            .find(|c| c.id == id)
            .ok_or_else(|| "Crew not found".to_string())?;
        (crew.path.clone(), crew.branch.clone(), crew.rig_id.clone())
    };

    // Step 2: Read rig path (lock rigs separately — no nested locks)
    let rig_path = {
        let rigs = state.rigs.lock().unwrap_or_else(|e| e.into_inner());
        let rig = rigs
            .iter()
            .find(|r| r.id == rig_id)
            .ok_or_else(|| "Rig not found".to_string())?;
        rig.path.clone()
    };

    // Step 3: Git operations (no locks held)
    git::remove_worktree(&rig_path, &crew_path)?;

    if let Err(e) = git::delete_branch(&rig_path, &crew_branch) {
        eprintln!("Warning: failed to delete local branch '{}': {}", crew_branch, e);
    }
    if let Err(e) = git::delete_remote_branch(&rig_path, &crew_branch) {
        eprintln!("Warning: failed to delete remote branch '{}': {}", crew_branch, e);
    }

    // Step 4: Soft-delete (lock crews again briefly)
    {
        let mut crews = state.crews.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(crew) = crews.iter_mut().find(|c| c.id == id) {
            crew.status = CrewStatus::Removed;
        }
        state.save_crews(&crews);
    }

    let _ = app.emit("data-changed", "");
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

/// Create a cross-rig worktree: branches from `source_rig_id` and places the
/// worktree inside `target_crew_path` (derived from the crew record).
/// Returns the worktree path on success.
#[tauri::command]
pub fn create_cross_rig_worktree(
    source_rig_id: String,
    crew_id: String,
    branch_name: Option<String>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<String, String> {
    // Gather crew info
    let (crew_path, crew_rig_id) = {
        let crews = state.crews.lock().unwrap_or_else(|e| e.into_inner());
        let crew = crews
            .iter()
            .find(|c| c.id == crew_id)
            .ok_or_else(|| "Crew not found".to_string())?;
        (crew.path.clone(), crew.rig_id.clone())
    };

    // Gather source rig path
    let source_rig_path = {
        let rigs = state.rigs.lock().unwrap_or_else(|e| e.into_inner());
        rigs.iter()
            .find(|r| r.id == source_rig_id)
            .map(|r| r.path.clone())
            .ok_or_else(|| "Source rig not found".to_string())?
    };

    // Validate crew belongs to a different rig (cross-rig guard)
    if crew_rig_id == source_rig_id {
        return Err("Source and target rigs are the same; use a regular worktree instead".to_string());
    }

    // Determine branch name (use crew_id slug if not given)
    let branch = branch_name.unwrap_or_else(|| format!("xrig/{}", &crew_id[..8.min(crew_id.len())]));

    // Create the worktree from source repo into crew_path
    let output = std::process::Command::new("git")
        .current_dir(&source_rig_path)
        .args(["worktree", "add", "-b", &branch, &crew_path])
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree add failed: {stderr}"));
    }

    // Mark crew as cross-rig (update source_rig_id field if present; otherwise just note in audit)
    {
        let crews = state.crews.lock().unwrap_or_else(|e| e.into_inner());
        // Clone rig id for audit below (no mut needed — crew model doesn't have cross_rig field yet)
        drop(crews);
    }

    use crate::models::audit::{AuditEvent, AuditEventType};
    state.append_audit_event(&AuditEvent::new(
        crew_rig_id.clone(),
        None,
        None,
        AuditEventType::ConvoyUpdated,
        serde_json::json!({
            "crew_id": crew_id,
            "cross_rig": true,
            "source_rig_id": source_rig_id,
            "worktree_path": crew_path,
            "branch": branch,
        }).to_string(),
    ));

    let _ = app.emit("data-changed", "");
    Ok(crew_path)
}
