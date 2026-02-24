use std::fs;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::models::hook::HookStatus;
use crate::models::task::{TaskPriority, TaskStatus};
use crate::models::worker::WorkerStatusEnum;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct TownRuntimeStatus {
    pub rigs_total: usize,
    pub tasks_total: usize,
    pub hooks_open: usize,
    pub workers_running: usize,
    pub workers_failed: usize,
    pub supervisor_running: bool,
    pub supervisor_started_at: Option<String>,
    pub ai_inbox_running: bool,
    pub ai_inbox_bind_addr: Option<String>,
    pub mayor_enabled: bool,
    pub deacon_enabled: bool,
    pub witness_enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DoctorIssue {
    pub code: String,
    pub severity: String,
    pub message: String,
    pub hint: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DoctorReport {
    pub checked_at: String,
    pub rig_scope: Option<String>,
    pub healthy: bool,
    pub issues: Vec<DoctorIssue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FixReport {
    pub fixed_at: String,
    pub rig_scope: Option<String>,
    pub supervisor_started: bool,
    pub reconciled_items_changed: usize,
    pub compact_removed_workers: usize,
    pub compact_removed_runs: usize,
    pub compact_removed_crews: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallReport {
    pub installed_at: String,
    pub town_dir: String,
    pub checks: Vec<String>,
    pub workflow_templates_existing: usize,
    pub prompt_templates_builtin: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct RolesStatus {
    pub mayor_enabled: bool,
    pub deacon_enabled: bool,
    pub witness_enabled: bool,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MayorPlanReport {
    pub planned_at: String,
    pub rig_id: String,
    pub objective: String,
    pub convoy_id: Option<String>,
    pub created_task_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeaconPatrolReport {
    pub patrolled_at: String,
    pub rig_scope: Option<String>,
    pub reconciled_items_changed: usize,
    pub escalated_tasks: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct WitnessAlert {
    pub severity: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WitnessReport {
    pub observed_at: String,
    pub rig_id: String,
    pub total_tasks: usize,
    pub stuck_tasks: usize,
    pub blocked_tasks: usize,
    pub escalated_tasks: usize,
    pub workers_running: usize,
    pub workers_failed: usize,
    pub hooks_idle: usize,
    pub hooks_assigned: usize,
    pub hooks_running: usize,
    pub alerts: Vec<WitnessAlert>,
}

#[derive(Debug, Clone, Deserialize)]
struct MayorTaskDraft {
    title: String,
    description: String,
}

fn snapshot_town_status(state: &AppState) -> TownRuntimeStatus {
    let rigs_total = state.rigs.lock().unwrap().len();
    let tasks_total = state.tasks.lock().unwrap().len();
    let hooks_open = state
        .hooks
        .lock()
        .unwrap()
        .iter()
        .filter(|h| h.status == HookStatus::Assigned || h.status == HookStatus::Running)
        .count();

    let workers = state.workers.lock().unwrap();
    let workers_running = workers
        .iter()
        .filter(|w| w.status == WorkerStatusEnum::Running)
        .count();
    let workers_failed = workers
        .iter()
        .filter(|w| w.status == WorkerStatusEnum::Failed)
        .count();
    drop(workers);

    let supervisor = state.supervisor.lock().unwrap();
    let ai_inbox = state.ai_inbox.lock().unwrap();
    let roles = state.roles.lock().unwrap();

    TownRuntimeStatus {
        rigs_total,
        tasks_total,
        hooks_open,
        workers_running,
        workers_failed,
        supervisor_running: supervisor.running,
        supervisor_started_at: supervisor.started_at.clone(),
        ai_inbox_running: ai_inbox.running,
        ai_inbox_bind_addr: ai_inbox.bind_addr.clone(),
        mayor_enabled: roles.mayor_enabled,
        deacon_enabled: roles.deacon_enabled,
        witness_enabled: roles.witness_enabled,
    }
}

#[cfg(target_os = "windows")]
fn kill_pid(pid: u32) {
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output();
}

#[cfg(not(target_os = "windows"))]
fn kill_pid(pid: u32) {
    let _ = std::process::Command::new("kill")
        .args(["-9", &pid.to_string()])
        .output();
}

fn ensure_rig_exists(state: &AppState, rig_id: &str) -> Result<(), String> {
    let rigs = state.rigs.lock().unwrap();
    if rigs.iter().any(|r| r.id == rig_id) {
        Ok(())
    } else {
        Err(format!("Rig not found: {}", rig_id))
    }
}

fn strip_list_prefix(line: &str) -> String {
    let trimmed = line.trim();
    let mut chars = trimmed.chars();
    let first = chars.next();
    match first {
        Some('-') | Some('*') | Some('•') => chars.as_str().trim().to_string(),
        Some(c) if c.is_ascii_digit() => {
            let remainder = chars.as_str().trim_start();
            if remainder.starts_with('.') || remainder.starts_with(')') {
                remainder[1..].trim().to_string()
            } else {
                trimmed.to_string()
            }
        }
        _ => trimmed.to_string(),
    }
}

fn parse_mayor_tasks(objective: &str, brief: Option<String>) -> Vec<MayorTaskDraft> {
    let mut out = Vec::new();
    if let Some(brief_text) = brief {
        for line in brief_text.lines().map(strip_list_prefix) {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let (title, description) = if let Some((lhs, rhs)) = line.split_once("::") {
                (lhs.trim().to_string(), rhs.trim().to_string())
            } else {
                (line.to_string(), String::new())
            };
            if !title.is_empty() {
                out.push(MayorTaskDraft { title, description });
            }
        }
    }

    if out.is_empty() {
        out.push(MayorTaskDraft {
            title: objective.trim().to_string(),
            description: String::new(),
        });
    }
    out
}

#[tauri::command]
pub fn town_install(state: State<AppState>) -> InstallReport {
    let mut checks = Vec::new();
    let town_dir = state.town_dir.clone();
    let worktrees = town_dir.join("worktrees");
    let logs = town_dir.join("logs");
    let templates = town_dir.join("templates");

    for path in [&town_dir, &worktrees, &logs, &templates] {
        if fs::create_dir_all(path).is_ok() {
            checks.push(format!("ok: {}", path.display()));
        } else {
            checks.push(format!("failed: {}", path.display()));
        }
    }

    let workflow_templates_existing = state.workflow_templates.lock().unwrap().len();
    let prompt_templates_builtin = crate::templates::get_builtin_templates().len();

    InstallReport {
        installed_at: chrono::Utc::now().to_rfc3339(),
        town_dir: town_dir.display().to_string(),
        checks,
        workflow_templates_existing,
        prompt_templates_builtin,
    }
}

#[tauri::command]
pub fn town_up(
    loop_interval_seconds: Option<u64>,
    auto_refinery_sync: Option<bool>,
    state: State<AppState>,
    app: AppHandle,
) -> crate::commands::supervisor::SupervisorStatus {
    crate::commands::supervisor::start_supervisor(
        loop_interval_seconds,
        auto_refinery_sync,
        state,
        app,
    )
}

#[tauri::command]
pub fn town_down(
    state: State<AppState>,
    app: AppHandle,
) -> crate::commands::supervisor::SupervisorStatus {
    crate::commands::supervisor::stop_supervisor(state, app)
}

#[tauri::command]
pub fn town_shutdown(state: State<AppState>, app: AppHandle) -> TownRuntimeStatus {
    let _ = crate::commands::supervisor::stop_supervisor(state.clone(), app.clone());
    let _ = crate::commands::ai_inbox::stop_ai_inbox(state.clone());

    {
        let mut workers = state.workers.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        for w in workers.iter_mut() {
            if w.status == WorkerStatusEnum::Running {
                if let Some(pid) = w.pid {
                    kill_pid(pid);
                }
                w.status = WorkerStatusEnum::Stopped;
                w.stopped_at = Some(now.clone());
            }
        }
        state.save_workers(&workers);
    }

    let _ = app.emit("data-changed", "");
    snapshot_town_status(&state)
}

#[tauri::command]
pub fn town_status(state: State<AppState>) -> TownRuntimeStatus {
    snapshot_town_status(&state)
}

#[tauri::command]
pub fn get_roles_status(state: State<AppState>) -> RolesStatus {
    let roles = state.roles.lock().unwrap();
    RolesStatus {
        mayor_enabled: roles.mayor_enabled,
        deacon_enabled: roles.deacon_enabled,
        witness_enabled: roles.witness_enabled,
        updated_at: roles.updated_at.clone(),
    }
}

#[tauri::command]
pub fn set_roles_status(
    mayor_enabled: Option<bool>,
    deacon_enabled: Option<bool>,
    witness_enabled: Option<bool>,
    state: State<AppState>,
) -> RolesStatus {
    let mut roles = state.roles.lock().unwrap();
    if let Some(v) = mayor_enabled {
        roles.mayor_enabled = v;
    }
    if let Some(v) = deacon_enabled {
        roles.deacon_enabled = v;
    }
    if let Some(v) = witness_enabled {
        roles.witness_enabled = v;
    }
    roles.updated_at = Some(chrono::Utc::now().to_rfc3339());
    RolesStatus {
        mayor_enabled: roles.mayor_enabled,
        deacon_enabled: roles.deacon_enabled,
        witness_enabled: roles.witness_enabled,
        updated_at: roles.updated_at.clone(),
    }
}

#[tauri::command]
pub fn mayor_plan_objective(
    rig_id: String,
    objective: String,
    brief: Option<String>,
    create_convoy: Option<bool>,
    priority: Option<TaskPriority>,
    tags: Option<Vec<String>>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<MayorPlanReport, String> {
    {
        let roles = state.roles.lock().unwrap();
        if !roles.mayor_enabled {
            return Err("Mayor role is disabled".to_string());
        }
    }
    ensure_rig_exists(&state, &rig_id)?;

    let convoy_id = if create_convoy.unwrap_or(true) {
        Some(
            crate::commands::convoys::create_convoy_internal(
                &state,
                objective.clone(),
                format!("Mayor plan for objective: {}", objective),
                vec![rig_id.clone()],
                Some("mayor"),
            )
            .convoy_id,
        )
    } else {
        None
    };

    let drafts = parse_mayor_tasks(&objective, brief);
    let task_priority = priority.unwrap_or(TaskPriority::Medium);
    let task_tags = tags.unwrap_or_default();

    let mut created_task_ids = Vec::new();
    for draft in drafts {
        if draft.title.trim().is_empty() {
            continue;
        }
        let task = crate::commands::tasks::create_task_internal(
            &state,
            &app,
            rig_id.clone(),
            draft.title,
            draft.description,
            task_tags.clone(),
            task_priority.clone(),
            None,
            None,
            None,
            Some("mayor"),
        );
        if let Some(ref cid) = convoy_id {
            let _ = crate::commands::convoys::add_item_to_convoy(
                cid.clone(),
                task.id.clone(),
                state.clone(),
            );
        }
        created_task_ids.push(task.id);
    }

    Ok(MayorPlanReport {
        planned_at: chrono::Utc::now().to_rfc3339(),
        rig_id,
        objective,
        convoy_id,
        created_task_ids,
    })
}

#[tauri::command]
pub fn deacon_patrol(
    rig_id: Option<String>,
    stuck_threshold_minutes: Option<i64>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<DeaconPatrolReport, String> {
    {
        let roles = state.roles.lock().unwrap();
        if !roles.deacon_enabled {
            return Err("Deacon role is disabled".to_string());
        }
    }

    let reconcile = crate::commands::supervisor::reconcile_queue(
        rig_id.clone(),
        state.clone(),
        app.clone(),
    );

    let mut escalated_tasks = 0usize;
    if let Some(ref rid) = rig_id {
        escalated_tasks = crate::commands::tasks::escalate_stuck_tasks(
            rid.clone(),
            stuck_threshold_minutes,
            state.clone(),
            app.clone(),
        )
        .len();
    } else {
        let rig_ids: Vec<String> = {
            let rigs = state.rigs.lock().unwrap();
            rigs.iter().map(|r| r.id.clone()).collect()
        };
        for rid in rig_ids {
            escalated_tasks += crate::commands::tasks::escalate_stuck_tasks(
                rid,
                stuck_threshold_minutes,
                state.clone(),
                app.clone(),
            )
            .len();
        }
    }

    Ok(DeaconPatrolReport {
        patrolled_at: chrono::Utc::now().to_rfc3339(),
        rig_scope: rig_id,
        reconciled_items_changed: reconcile.items_changed,
        escalated_tasks,
    })
}

#[tauri::command]
pub fn witness_report(rig_id: String, state: State<AppState>) -> Result<WitnessReport, String> {
    {
        let roles = state.roles.lock().unwrap();
        if !roles.witness_enabled {
            return Err("Witness role is disabled".to_string());
        }
    }
    ensure_rig_exists(&state, &rig_id)?;

    let metrics = crate::commands::tasks::get_health_metrics(rig_id.clone(), Some(30), state.clone());
    let queue = crate::commands::hooks::get_rig_queue(rig_id.clone(), state.clone());
    let mut alerts = Vec::new();

    if metrics.stuck_tasks.len() > 0 {
        alerts.push(WitnessAlert {
            severity: "high".to_string(),
            code: "STUCK_TASKS".to_string(),
            message: format!("{} stuck task(s) detected", metrics.stuck_tasks.len()),
        });
    }
    if metrics.workers_failed > 0 {
        alerts.push(WitnessAlert {
            severity: "medium".to_string(),
            code: "FAILED_WORKERS".to_string(),
            message: format!("{} failed worker(s)", metrics.workers_failed),
        });
    }
    if metrics.blocked > 0 || metrics.escalated > 0 {
        alerts.push(WitnessAlert {
            severity: "medium".to_string(),
            code: "BLOCKED_OR_ESCALATED".to_string(),
            message: format!(
                "{} blocked + {} escalated task(s)",
                metrics.blocked, metrics.escalated
            ),
        });
    }
    if metrics.handoffs_pending > 0 {
        alerts.push(WitnessAlert {
            severity: "low".to_string(),
            code: "PENDING_HANDOFFS".to_string(),
            message: format!("{} pending handoff(s)", metrics.handoffs_pending),
        });
    }

    Ok(WitnessReport {
        observed_at: chrono::Utc::now().to_rfc3339(),
        rig_id,
        total_tasks: metrics.total_tasks,
        stuck_tasks: metrics.stuck_tasks.len(),
        blocked_tasks: metrics.blocked,
        escalated_tasks: metrics.escalated,
        workers_running: metrics.workers_running,
        workers_failed: metrics.workers_failed,
        hooks_idle: queue.hooks_idle,
        hooks_assigned: queue.hooks_assigned,
        hooks_running: queue.hooks_running,
        alerts,
    })
}

#[tauri::command]
pub fn town_doctor(rig_id: Option<String>, state: State<AppState>) -> DoctorReport {
    let checked_at = chrono::Utc::now().to_rfc3339();
    let mut issues = Vec::new();

    let rigs = state.rigs.lock().unwrap();
    if rigs.is_empty() {
        issues.push(DoctorIssue {
            code: "NO_RIGS".to_string(),
            severity: "high".to_string(),
            message: "No rigs configured".to_string(),
            hint: "Add at least one git repository as a rig.".to_string(),
        });
    }
    if let Some(ref rid) = rig_id {
        if !rigs.iter().any(|r| r.id == *rid) {
            issues.push(DoctorIssue {
                code: "RIG_NOT_FOUND".to_string(),
                severity: "high".to_string(),
                message: format!("Rig scope '{}' does not exist", rid),
                hint: "Use a valid rig id from list_rigs.".to_string(),
            });
        }
    }
    drop(rigs);

    let settings = state.settings.lock().unwrap();
    if settings.default_cli.trim().is_empty() {
        issues.push(DoctorIssue {
            code: "DEFAULT_CLI_EMPTY".to_string(),
            severity: "medium".to_string(),
            message: "default_cli is empty".to_string(),
            hint: "Set Settings -> Default CLI to a valid agent.".to_string(),
        });
    }
    drop(settings);

    let tasks = state.tasks.lock().unwrap();
    let workers = state.workers.lock().unwrap();
    let hooks = state.hooks.lock().unwrap();
    let actors = state.actors.lock().unwrap();

    let in_scope_task = |rig: &str| rig_id.as_deref().map(|rid| rid == rig).unwrap_or(true);

    let running_worker_ids: std::collections::HashSet<String> = workers
        .iter()
        .filter(|w| w.status == WorkerStatusEnum::Running)
        .map(|w| w.id.clone())
        .collect();
    let failed_worker_count = workers
        .iter()
        .filter(|w| {
            w.status == WorkerStatusEnum::Failed
                && rig_id
                    .as_deref()
                    .map(|rid| rid == w.rig_id)
                    .unwrap_or(true)
        })
        .count();
    if failed_worker_count > 0 {
        issues.push(DoctorIssue {
            code: "FAILED_WORKERS".to_string(),
            severity: "medium".to_string(),
            message: format!("{} failed worker(s) detected", failed_worker_count),
            hint: "Inspect Run History and worker logs, then resume/reassign tasks.".to_string(),
        });
    }

    let orphan_in_progress = tasks
        .iter()
        .filter(|t| t.status == TaskStatus::InProgress && in_scope_task(&t.rig_id))
        .filter(|t| {
            t.assigned_worker_id
                .as_ref()
                .map(|id| !running_worker_ids.contains(id))
                .unwrap_or(true)
        })
        .count();
    if orphan_in_progress > 0 {
        issues.push(DoctorIssue {
            code: "ORPHAN_IN_PROGRESS".to_string(),
            severity: "high".to_string(),
            message: format!(
                "{} in-progress task(s) have no running worker",
                orphan_in_progress
            ),
            hint: "Run queue reconcile or sling these tasks to healthy hooks.".to_string(),
        });
    }

    let hooks_without_task = hooks
        .iter()
        .filter(|h| {
            (h.status == HookStatus::Assigned || h.status == HookStatus::Running)
                && h.current_work_id.is_none()
                && rig_id
                    .as_deref()
                    .map(|rid| rid == h.rig_id)
                    .unwrap_or(true)
        })
        .count();
    if hooks_without_task > 0 {
        issues.push(DoctorIssue {
            code: "HOOK_NO_TASK".to_string(),
            severity: "medium".to_string(),
            message: format!("{} active hook(s) have no current_work_id", hooks_without_task),
            hint: "Assign tasks to those hooks or reset them to idle.".to_string(),
        });
    }

    if let Some(ref rid) = rig_id {
        let actor_count = actors.iter().filter(|a| a.rig_id == *rid).count();
        if actor_count == 0 {
            issues.push(DoctorIssue {
                code: "NO_ACTORS".to_string(),
                severity: "low".to_string(),
                message: "No actors in selected rig".to_string(),
                hint: "Create actors to enable stable ownership and handoff flow.".to_string(),
            });
        }
    }

    drop(tasks);
    drop(workers);
    drop(hooks);
    drop(actors);

    DoctorReport {
        checked_at,
        rig_scope: rig_id,
        healthy: issues.is_empty(),
        issues,
    }
}

#[tauri::command]
pub fn town_fix(
    rig_id: Option<String>,
    finished_worker_retention_days: Option<i64>,
    state: State<AppState>,
    app: AppHandle,
) -> FixReport {
    let mut supervisor_started = false;
    {
        let sup = state.supervisor.lock().unwrap();
        if !sup.running {
            supervisor_started = true;
        }
    }
    if supervisor_started {
        let _ = crate::commands::supervisor::start_supervisor(None, None, state.clone(), app.clone());
    }

    let reconcile = crate::commands::supervisor::reconcile_queue(
        rig_id.clone(),
        state.clone(),
        app.clone(),
    );
    let compact = crate::commands::supervisor::compact_state(
        rig_id.clone(),
        finished_worker_retention_days,
        state,
        app,
    );

    FixReport {
        fixed_at: chrono::Utc::now().to_rfc3339(),
        rig_scope: rig_id,
        supervisor_started,
        reconciled_items_changed: reconcile.items_changed,
        compact_removed_workers: compact.removed_workers,
        compact_removed_runs: compact.removed_runs,
        compact_removed_crews: compact.removed_crews,
    }
}
