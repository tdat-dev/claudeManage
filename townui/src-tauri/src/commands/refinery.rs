use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::git;
use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::crew::CrewStatus;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct RefineryQueueItem {
    pub crew_id: String,
    pub crew_name: String,
    pub branch: String,
    pub has_uncommitted_changes: bool,
    pub ahead_by_commits: u32,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RefinerySkipItem {
    pub crew_id: String,
    pub crew_name: String,
    pub branch: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RefineryConflictItem {
    pub crew_id: String,
    pub crew_name: String,
    pub branch: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RefinerySyncReport {
    pub rig_id: String,
    pub base_branch: String,
    pub synced_at: String,
    pub merged_branches: Vec<String>,
    pub skipped: Vec<RefinerySkipItem>,
    pub conflicts: Vec<RefineryConflictItem>,
    pub warnings: Vec<String>,
    pub pushed: bool,
    pub restored_branch: Option<String>,
}

fn resolve_rig_path(state: &AppState, rig_id: &str) -> Result<String, String> {
    let rigs = state.rigs.lock().unwrap();
    rigs.iter()
        .find(|r| r.id == rig_id)
        .map(|r| r.path.clone())
        .ok_or_else(|| "Rig not found".to_string())
}

fn list_active_crews(state: &AppState, rig_id: &str) -> Vec<crate::models::crew::Crew> {
    let crews = state.crews.lock().unwrap();
    crews
        .iter()
        .filter(|c| c.rig_id == rig_id && c.status == CrewStatus::Active)
        .cloned()
        .collect()
}

#[tauri::command]
pub fn get_refinery_queue(rig_id: String, state: State<AppState>) -> Result<Vec<RefineryQueueItem>, String> {
    let rig_path = resolve_rig_path(&state, &rig_id)?;
    let base_branch = git::get_current_branch(&rig_path).unwrap_or_else(|| "main".to_string());
    let crews = list_active_crews(&state, &rig_id);

    let mut items = Vec::new();
    for crew in crews {
        let dirty = git::has_uncommitted_changes(&crew.path).unwrap_or(true);
        let ahead = git::count_commits_ahead(&rig_path, &base_branch, &crew.branch).unwrap_or(0);
        let status = if dirty {
            "blocked_dirty".to_string()
        } else if ahead > 0 {
            "ready".to_string()
        } else {
            "up_to_date".to_string()
        };

        items.push(RefineryQueueItem {
            crew_id: crew.id,
            crew_name: crew.name,
            branch: crew.branch,
            has_uncommitted_changes: dirty,
            ahead_by_commits: ahead,
            status,
        });
    }

    Ok(items)
}

pub(crate) fn sync_rig_inner(
    state: &AppState,
    app: Option<&AppHandle>,
    rig_id: &str,
    base_branch_override: Option<&str>,
    push_remote: bool,
) -> Result<RefinerySyncReport, String> {
    let rig_path = resolve_rig_path(state, rig_id)?;
    let crews = list_active_crews(state, rig_id);

    let current_branch = git::get_current_branch(&rig_path).unwrap_or_else(|| "main".to_string());
    let base_branch = base_branch_override
        .map(|s| s.to_string())
        .unwrap_or_else(|| current_branch.clone());

    if git::has_uncommitted_changes(&rig_path)? {
        return Err("Rig working tree has uncommitted changes. Commit or stash before refinery sync.".to_string());
    }

    let mut warnings = Vec::new();
    if let Err(e) = git::fetch_all(&rig_path) {
        warnings.push(format!("fetch_failed: {}", e));
    }

    let mut switched = false;
    if current_branch != base_branch {
        git::checkout_branch(&rig_path, &base_branch)?;
        switched = true;
    }

    if let Err(e) = git::pull_ff_only(&rig_path, "origin", &base_branch) {
        warnings.push(format!("pull_ff_only_failed: {}", e));
    }

    let mut merged_branches = Vec::new();
    let mut skipped = Vec::new();
    let mut conflicts = Vec::new();

    for crew in crews {
        if crew.branch == base_branch {
            skipped.push(RefinerySkipItem {
                crew_id: crew.id,
                crew_name: crew.name,
                branch: crew.branch,
                reason: "branch_is_base".to_string(),
            });
            continue;
        }

        match git::has_uncommitted_changes(&crew.path) {
            Ok(true) => {
                skipped.push(RefinerySkipItem {
                    crew_id: crew.id,
                    crew_name: crew.name,
                    branch: crew.branch,
                    reason: "crew_has_uncommitted_changes".to_string(),
                });
                continue;
            }
            Err(e) => {
                skipped.push(RefinerySkipItem {
                    crew_id: crew.id,
                    crew_name: crew.name,
                    branch: crew.branch,
                    reason: format!("crew_status_error: {}", e),
                });
                continue;
            }
            Ok(false) => {}
        }

        let ahead = match git::count_commits_ahead(&rig_path, &base_branch, &crew.branch) {
            Ok(n) => n,
            Err(e) => {
                skipped.push(RefinerySkipItem {
                    crew_id: crew.id,
                    crew_name: crew.name,
                    branch: crew.branch,
                    reason: format!("ahead_count_error: {}", e),
                });
                continue;
            }
        };

        if ahead == 0 {
            skipped.push(RefinerySkipItem {
                crew_id: crew.id,
                crew_name: crew.name,
                branch: crew.branch,
                reason: "no_new_commits".to_string(),
            });
            continue;
        }

        match git::merge_branch_no_edit(&rig_path, &crew.branch) {
            Ok(_) => {
                merged_branches.push(crew.branch.clone());
            }
            Err(e) => {
                git::abort_merge(&rig_path);
                conflicts.push(RefineryConflictItem {
                    crew_id: crew.id,
                    crew_name: crew.name,
                    branch: crew.branch,
                    error: e,
                });
            }
        }
    }

    let mut pushed = false;
    if push_remote && !merged_branches.is_empty() {
        match git::push_branch(&rig_path, &base_branch) {
            Ok(_) => pushed = true,
            Err(e) => warnings.push(format!("push_failed: {}", e)),
        }
    }

    let mut restored_branch = None;
    if switched {
        match git::checkout_branch(&rig_path, &current_branch) {
            Ok(_) => restored_branch = Some(current_branch.clone()),
            Err(e) => warnings.push(format!("restore_branch_failed: {}", e)),
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    let report = RefinerySyncReport {
        rig_id: rig_id.to_string(),
        base_branch: base_branch.clone(),
        synced_at: now.clone(),
        merged_branches: merged_branches.clone(),
        skipped: skipped.clone(),
        conflicts: conflicts.clone(),
        warnings: warnings.clone(),
        pushed,
        restored_branch,
    };

    let event_type = if conflicts.is_empty() {
        AuditEventType::RefinerySynced
    } else {
        AuditEventType::RefinerySyncFailed
    };
    let payload = serde_json::json!({
        "base_branch": base_branch,
        "merged_branches": merged_branches,
        "conflicts": conflicts.iter().map(|c| c.branch.clone()).collect::<Vec<_>>(),
        "warnings": warnings,
        "push_remote": push_remote,
        "pushed": pushed,
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        rig_id.to_string(),
        None,
        None,
        event_type,
        payload,
    ));

    if !report.merged_branches.is_empty() || !report.conflicts.is_empty() {
        if let Some(app_handle) = app {
            let _ = app_handle.emit("data-changed", "");
        }
    }

    Ok(report)
}

#[tauri::command]
pub fn sync_rig_refinery(
    rig_id: String,
    base_branch: Option<String>,
    push_remote: Option<bool>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<RefinerySyncReport, String> {
    sync_rig_inner(
        &state,
        Some(&app),
        &rig_id,
        base_branch.as_deref(),
        push_remote.unwrap_or(false),
    )
}
