use std::collections::{HashMap, HashSet};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::hook::{Hook, HookStatus};
use crate::models::task::{Task, TaskStatus};
use crate::models::worker::WorkerStatusEnum;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct SupervisorStatus {
    pub running: bool,
    pub started_at: Option<String>,
    pub last_reconcile_at: Option<String>,
    pub last_compact_at: Option<String>,
    pub loop_interval_seconds: u64,
    pub auto_refinery_sync: bool,
    pub rigs_total: usize,
    pub hooks_open: usize,
    pub workers_running: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReconcileItem {
    pub rig_id: String,
    pub hook_id: String,
    pub task_id: Option<String>,
    pub action: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReconcileReport {
    pub reconciled_at: String,
    pub checked_hooks: usize,
    pub items_changed: usize,
    pub items: Vec<ReconcileItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompactReport {
    pub compacted_at: String,
    pub removed_workers: usize,
    pub removed_runs: usize,
    pub removed_crews: usize,
}

#[derive(Debug, Clone)]
struct ReconcileDecision {
    rig_id: String,
    hook_id: String,
    task_id: Option<String>,
    action: String,
    reason: String,
}

fn snapshot_status(state: &AppState) -> SupervisorStatus {
    let supervisor = state.supervisor.lock().unwrap();
    let rigs_total = state.rigs.lock().unwrap().len();
    let hooks_open = state
        .hooks
        .lock()
        .unwrap()
        .iter()
        .filter(|h| h.status == HookStatus::Assigned || h.status == HookStatus::Running)
        .count();
    let workers_running = state
        .workers
        .lock()
        .unwrap()
        .iter()
        .filter(|w| w.status == WorkerStatusEnum::Running)
        .count();

    SupervisorStatus {
        running: supervisor.running,
        started_at: supervisor.started_at.clone(),
        last_reconcile_at: supervisor.last_reconcile_at.clone(),
        last_compact_at: supervisor.last_compact_at.clone(),
        loop_interval_seconds: supervisor.loop_interval_seconds,
        auto_refinery_sync: supervisor.auto_refinery_sync,
        rigs_total,
        hooks_open,
        workers_running,
    }
}

fn append_reconcile_audit(state: &AppState, decision: &ReconcileDecision) {
    let event_type = if decision.action == "requeued" {
        AuditEventType::HookAssigned
    } else {
        AuditEventType::HookDone
    };

    let payload = serde_json::json!({
        "hook_id": decision.hook_id,
        "work_item_id": decision.task_id,
        "action": decision.action,
        "reason": decision.reason,
        "auto_reconciled": true,
    })
    .to_string();

    state.append_audit_event(&AuditEvent::new(
        decision.rig_id.clone(),
        None,
        decision.task_id.clone(),
        event_type,
        payload,
    ));
}

fn reconcile_queue_inner(state: &AppState, rig_id: Option<&str>, app: Option<&AppHandle>) -> ReconcileReport {
    let hooks_snapshot: Vec<Hook> = {
        let hooks = state.hooks.lock().unwrap();
        hooks.iter()
            .filter(|h| rig_id.map(|rid| h.rig_id == rid).unwrap_or(true))
            .cloned()
            .collect()
    };

    let tasks_snapshot: HashMap<String, Task> = {
        let tasks = state.tasks.lock().unwrap();
        tasks.iter()
            .filter(|t| rig_id.map(|rid| t.rig_id == rid).unwrap_or(true))
            .map(|t| (t.id.clone(), t.clone()))
            .collect()
    };

    let running_workers: HashSet<String> = {
        let workers = state.workers.lock().unwrap();
        workers
            .iter()
            .filter(|w| {
                w.status == WorkerStatusEnum::Running
                    && rig_id.map(|rid| w.rig_id == rid).unwrap_or(true)
            })
            .map(|w| w.id.clone())
            .collect()
    };

    let mut decisions = Vec::new();

    for hook in &hooks_snapshot {
        if hook.status != HookStatus::Assigned && hook.status != HookStatus::Running {
            continue;
        }
        let Some(work_id) = &hook.current_work_id else {
            continue;
        };

        let Some(task) = tasks_snapshot.get(work_id) else {
            decisions.push(ReconcileDecision {
                rig_id: hook.rig_id.clone(),
                hook_id: hook.hook_id.clone(),
                task_id: Some(work_id.clone()),
                action: "cleared".to_string(),
                reason: "missing_task".to_string(),
            });
            continue;
        };

        if task.status == TaskStatus::Done || task.status == TaskStatus::Cancelled {
            decisions.push(ReconcileDecision {
                rig_id: hook.rig_id.clone(),
                hook_id: hook.hook_id.clone(),
                task_id: Some(work_id.clone()),
                action: "cleared".to_string(),
                reason: "task_closed".to_string(),
            });
            continue;
        }

        let has_running_worker = task
            .assigned_worker_id
            .as_ref()
            .map(|wid| running_workers.contains(wid))
            .unwrap_or(false);

        if !has_running_worker {
            let reason = if task.assigned_worker_id.is_none() {
                "unassigned_task"
            } else {
                "worker_not_running"
            };
            decisions.push(ReconcileDecision {
                rig_id: hook.rig_id.clone(),
                hook_id: hook.hook_id.clone(),
                task_id: Some(work_id.clone()),
                action: "requeued".to_string(),
                reason: reason.to_string(),
            });
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    if !decisions.is_empty() {
        {
            let mut hooks = state.hooks.lock().unwrap();
            for decision in &decisions {
                if let Some(hook) = hooks.iter_mut().find(|h| h.hook_id == decision.hook_id) {
                    hook.last_heartbeat = now.clone();
                    hook.worker_id = None;
                    if decision.action == "cleared" {
                        hook.current_work_id = None;
                        hook.state_blob = None;
                        hook.lease_token = None;
                        hook.lease_expires_at = None;
                        hook.status = HookStatus::Idle;
                    } else {
                        hook.lease_token = None;
                        hook.lease_expires_at = None;
                        hook.status = HookStatus::Assigned;
                    }
                }
            }
            state.save_hooks(&hooks);
        }

        {
            let mut tasks = state.tasks.lock().unwrap();
            for decision in &decisions {
                if decision.action != "requeued" {
                    continue;
                }
                let Some(task_id) = &decision.task_id else {
                    continue;
                };
                if let Some(task) = tasks.iter_mut().find(|t| t.id == *task_id) {
                    if task.status == TaskStatus::InProgress {
                        task.status = TaskStatus::Escalated;
                    }
                    task.assigned_worker_id = None;
                    task.blocked_reason = Some(format!(
                        "Queue reconciler marked orphaned work: {}",
                        decision.reason
                    ));
                    task.updated_at = now.clone();

                    let payload = serde_json::json!({
                        "old_status": "in_progress",
                        "new_status": &task.status,
                        "reason": decision.reason,
                        "auto_reconciled": true,
                    })
                    .to_string();
                    state.append_audit_event(&AuditEvent::new(
                        task.rig_id.clone(),
                        task.owner_actor_id.clone(),
                        Some(task.id.clone()),
                        AuditEventType::TaskStatusChanged,
                        payload,
                    ));
                }
            }
            state.save_tasks(&tasks);
        }

        for decision in &decisions {
            append_reconcile_audit(state, decision);
        }

        if let Some(app) = app {
            let _ = app.emit("data-changed", "");
        }
    }

    {
        let mut sup = state.supervisor.lock().unwrap();
        sup.last_reconcile_at = Some(now.clone());
    }

    let mut rig_for_event = rig_id.map(|s| s.to_string());
    if rig_for_event.is_none() {
        rig_for_event = decisions.first().map(|d| d.rig_id.clone());
    }
    if let Some(rid) = rig_for_event {
        let payload = serde_json::json!({
            "checked_hooks": hooks_snapshot.len(),
            "items_changed": decisions.len(),
            "scope_rig_id": rig_id,
        })
        .to_string();
        state.append_audit_event(&AuditEvent::new(
            rid,
            None,
            None,
            AuditEventType::QueueReconciled,
            payload,
        ));
    }

    ReconcileReport {
        reconciled_at: now,
        checked_hooks: hooks_snapshot.len(),
        items_changed: decisions.len(),
        items: decisions
            .into_iter()
            .map(|d| ReconcileItem {
                rig_id: d.rig_id,
                hook_id: d.hook_id,
                task_id: d.task_id,
                action: d.action,
                reason: d.reason,
            })
            .collect(),
    }
}

/// Propulsion: for each rig that has pending Todo tasks but no running workers,
/// auto-spawn a worker on the first idle crew in that rig.
fn run_propulsion_cycle(state: &AppState, app: &AppHandle) {
    let (tasks_snapshot, workers_snapshot, crews_snapshot) = {
        let t = state.tasks.lock().unwrap();
        let w = state.workers.lock().unwrap();
        let c = state.crews.lock().unwrap();
        (t.clone(), w.clone(), c.clone())
    };

    // Collect rig_ids that have at least one running worker
    let busy_rigs: HashSet<String> = workers_snapshot
        .iter()
        .filter(|w| w.status == WorkerStatusEnum::Running)
        .map(|w| w.rig_id.clone())
        .collect();

    // Collect rig_ids that have at least one Todo task
    let rigs_with_work: HashSet<String> = tasks_snapshot
        .iter()
        .filter(|t| t.status == TaskStatus::Todo)
        .map(|t| t.rig_id.clone())
        .collect();

    // Find rigs that need propulsion = have work but no running worker
    let rigs_to_push: Vec<String> = rigs_with_work
        .into_iter()
        .filter(|rid| !busy_rigs.contains(rid))
        .collect();

    if rigs_to_push.is_empty() {
        return;
    }

    for rig_id in &rigs_to_push {
        // Pick the first active crew in this rig
        let crew_id = match crews_snapshot.iter().find(|c| {
            &c.rig_id == rig_id
                && c.status == crate::models::crew::CrewStatus::Active
        }) {
            Some(c) => c.id.clone(),
            None => continue,
        };

        let task_id = tasks_snapshot
            .iter()
            .find(|t| &t.rig_id == rig_id && t.status == TaskStatus::Todo)
            .map(|t| t.id.clone());

        let spawn_result = crate::commands::workers::spawn_worker_for_propulsion(
            state,
            app,
            rig_id,
            &crew_id,
            task_id.as_deref(),
        );
        match spawn_result {
            Ok(worker_id) => {
                state.append_audit_event(&AuditEvent::new(
                    rig_id.clone(),
                    None,
                    task_id,
                    AuditEventType::WorkerSpawned,
                    serde_json::json!({
                        "propulsion": true,
                        "crew_id": crew_id,
                        "worker_id": worker_id,
                    }).to_string(),
                ));
            }
            Err(e) => {
                eprintln!("[propulsion] failed to spawn worker for rig {rig_id}: {e}");
            }
        }
    }

    let _ = app.emit("data-changed", "");
}

/// Witness: per-rig polecat lifecycle management.
/// - Spawn polecats for rigs that have no running polecat but have open hooks.
/// - Nudge stuck polecats (no heartbeat for > polecat_nudge_after_seconds).
/// - Recycle (stop) polecats for rigs that have no remaining hooks.
fn run_witness_cycle(state: &AppState, app: &AppHandle) {
    let (max_polecats, nudge_after_seconds) = {
        let settings = state.settings.lock().unwrap();
        (
            settings.max_polecats_per_rig,
            settings.polecat_nudge_after_seconds,
        )
    };

    let rig_ids: Vec<String> = {
        let rigs = state.rigs.lock().unwrap();
        rigs.iter().map(|r| r.id.clone()).collect()
    };

    for rig_id in &rig_ids {
        // Count open hooks on this rig
        let open_hooks: usize = {
            let hooks = state.hooks.lock().unwrap();
            hooks
                .iter()
                .filter(|h| h.rig_id == *rig_id && h.status == HookStatus::Idle)
                .count()
        };

        // Get polecats on this rig
        let polecat_workers: Vec<crate::models::worker::Worker> = {
            let workers = state.workers.lock().unwrap();
            workers
                .iter()
                .filter(|w| {
                    w.rig_id == *rig_id
                        && w.worker_type == crate::models::worker::WorkerType::Polecat
                        && w.status == WorkerStatusEnum::Running
                })
                .cloned()
                .collect()
        };

        let running_polecats = polecat_workers.len();

        // Recycle polecats if no open hooks remain
        if open_hooks == 0 && running_polecats > 0 {
            for pw in &polecat_workers {
                eprintln!("[witness] recycling idle polecat {} on rig {rig_id}", pw.id);
                let _ = crate::commands::workers::stop_worker_inner(state, &pw.id);
            }
            continue;
        }

        // Nudge stuck polecats
        let now_ts = chrono::Utc::now().timestamp() as u64;
        for pw in &polecat_workers {
            if let Ok(started) = chrono::DateTime::parse_from_rfc3339(&pw.started_at) {
                let elapsed = now_ts.saturating_sub(started.timestamp() as u64);
                if elapsed > nudge_after_seconds {
                    // Send a nudge character to the PTY
                    let _ = crate::commands::workers::nudge_worker_pty(state, &pw.id);
                    eprintln!("[witness] nudged polecat {} (elapsed {elapsed}s)", pw.id);
                }
            }
        }

        // Spawn new polecats up to max if we have open hooks
        if open_hooks > 0 && running_polecats < max_polecats {
            let to_spawn = (max_polecats - running_polecats).min(open_hooks);
            for _ in 0..to_spawn {
                let result = crate::commands::workers::spawn_polecat_inner(state, app, rig_id);
                match result {
                    Ok(id) => eprintln!("[witness] spawned polecat {id} on rig {rig_id}"),
                    Err(e) => eprintln!("[witness] failed to spawn polecat on rig {rig_id}: {e}"),
                }
            }
        }
    }

    let _ = app.emit("data-changed", "");
}

fn spawn_supervisor_loop(app: AppHandle) {
    let _ = thread::Builder::new()
        .name("town-supervisor".to_string())
        .spawn(move || {
            let mut propulsion_tick: u64 = 0;
            loop {
                let (running, interval, auto_refinery_sync) = {
                    let state = app.state::<AppState>();
                    let sup = state.supervisor.lock().unwrap();
                    (
                        sup.running,
                        sup.loop_interval_seconds.max(5),
                        sup.auto_refinery_sync,
                    )
                };
                if !running {
                    break;
                }
                let state = app.state::<AppState>();
                let _ = reconcile_queue_inner(&state, None, Some(&app));
                if auto_refinery_sync {
                    let rig_ids: Vec<String> = {
                        let rigs = state.rigs.lock().unwrap();
                        rigs.iter().map(|r| r.id.clone()).collect()
                    };
                    for rid in rig_ids {
                        let _ = crate::commands::refinery::sync_rig_inner(
                            &state,
                            Some(&app),
                            &rid,
                            None,
                            false,
                        );
                    }
                }

                // Propulsion enforcement
                propulsion_tick += interval;
                let (propulsion_enabled, propulsion_interval, witness_auto_spawn) = {
                    let settings = state.settings.lock().unwrap();
                    (
                        settings.propulsion_enabled,
                        settings.propulsion_interval_seconds.max(10),
                        settings.witness_auto_spawn,
                    )
                };
                if propulsion_enabled && propulsion_tick >= propulsion_interval {
                    propulsion_tick = 0;
                    run_propulsion_cycle(&state, &app);
                }
                if witness_auto_spawn {
                    run_witness_cycle(&state, &app);
                }

                thread::sleep(Duration::from_secs(interval));
            }
        });
}

#[tauri::command]
pub fn get_supervisor_status(state: State<AppState>) -> SupervisorStatus {
    snapshot_status(&state)
}

#[tauri::command]
pub fn start_supervisor(
    loop_interval_seconds: Option<u64>,
    auto_refinery_sync: Option<bool>,
    state: State<AppState>,
    app: AppHandle,
) -> SupervisorStatus {
    let now = chrono::Utc::now().to_rfc3339();
    let mut should_spawn_loop = false;
    {
        let mut sup = state.supervisor.lock().unwrap();
        if !sup.running {
            sup.running = true;
            sup.started_at = Some(now.clone());
            should_spawn_loop = true;
        }
        if let Some(interval) = loop_interval_seconds {
            sup.loop_interval_seconds = interval.max(5);
        }
        if let Some(enabled) = auto_refinery_sync {
            sup.auto_refinery_sync = enabled;
        }
    }

    if should_spawn_loop {
        let rigs: Vec<String> = {
            let all = state.rigs.lock().unwrap();
            all.iter().map(|r| r.id.clone()).collect()
        };
        for rid in rigs {
            state.append_audit_event(&AuditEvent::new(
                rid,
                None,
                None,
                AuditEventType::SupervisorStarted,
                serde_json::json!({
                    "loop_interval_seconds": loop_interval_seconds,
                    "auto_refinery_sync": auto_refinery_sync
                }).to_string(),
            ));
        }
        spawn_supervisor_loop(app.clone());
        let _ = app.emit("data-changed", "");
    }

    snapshot_status(&state)
}

#[tauri::command]
pub fn stop_supervisor(state: State<AppState>, app: AppHandle) -> SupervisorStatus {
    let was_running = {
        let mut sup = state.supervisor.lock().unwrap();
        let prev = sup.running;
        sup.running = false;
        prev
    };

    if was_running {
        let rigs: Vec<String> = {
            let all = state.rigs.lock().unwrap();
            all.iter().map(|r| r.id.clone()).collect()
        };
        for rid in rigs {
            state.append_audit_event(&AuditEvent::new(
                rid,
                None,
                None,
                AuditEventType::SupervisorStopped,
                "{}".to_string(),
            ));
        }
        let _ = app.emit("data-changed", "");
    }

    snapshot_status(&state)
}

#[tauri::command]
pub fn reconcile_queue(
    rig_id: Option<String>,
    state: State<AppState>,
    app: AppHandle,
) -> ReconcileReport {
    reconcile_queue_inner(&state, rig_id.as_deref(), Some(&app))
}

#[tauri::command]
pub fn compact_state(
    rig_id: Option<String>,
    finished_worker_retention_days: Option<i64>,
    state: State<AppState>,
    app: AppHandle,
) -> CompactReport {
    let now = chrono::Utc::now();
    let cutoff_days = finished_worker_retention_days.unwrap_or(7).max(0);
    let cutoff = now - chrono::Duration::days(cutoff_days);

    let removed_worker_ids = {
        let mut workers = state.workers.lock().unwrap();
        let mut removed = Vec::new();
        workers.retain(|w| {
            if rig_id.as_ref().map(|rid| &w.rig_id == rid).unwrap_or(true)
                && w.status != WorkerStatusEnum::Running
            {
                if let Some(stopped_at) = &w.stopped_at {
                    if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(stopped_at) {
                        if ts.with_timezone(&chrono::Utc) <= cutoff {
                            removed.push(w.id.clone());
                            return false;
                        }
                    }
                }
            }
            true
        });
        if !removed.is_empty() {
            state.save_workers(&workers);
        }
        removed
    };

    for worker_id in &removed_worker_ids {
        state.delete_log(worker_id);
    }

    let removed_runs = {
        let removed_set: HashSet<String> = removed_worker_ids.iter().cloned().collect();
        let mut runs = state.runs.lock().unwrap();
        let before = runs.len();
        runs.retain(|r| !removed_set.contains(&r.worker_id));
        let removed = before.saturating_sub(runs.len());
        if removed > 0 {
            state.save_runs(&runs);
        }
        removed
    };

    let removed_crews = {
        let mut crews = state.crews.lock().unwrap();
        let before = crews.len();
        crews.retain(|c| {
            c.status != crate::models::crew::CrewStatus::Removed
                || !rig_id.as_ref().map(|rid| &c.rig_id == rid).unwrap_or(true)
        });
        let removed = before.saturating_sub(crews.len());
        if removed > 0 {
            state.save_crews(&crews);
        }
        removed
    };

    let compacted_at = now.to_rfc3339();
    {
        let mut sup = state.supervisor.lock().unwrap();
        sup.last_compact_at = Some(compacted_at.clone());
    }

    let mut rig_for_event = rig_id.clone();
    if rig_for_event.is_none() {
        rig_for_event = state.rigs.lock().unwrap().first().map(|r| r.id.clone());
    }
    if let Some(rid) = rig_for_event {
        state.append_audit_event(&AuditEvent::new(
            rid,
            None,
            None,
            AuditEventType::StateCompacted,
            serde_json::json!({
                "removed_workers": removed_worker_ids.len(),
                "removed_runs": removed_runs,
                "removed_crews": removed_crews,
                "retention_days": cutoff_days,
            })
            .to_string(),
        ));
    }

    if !removed_worker_ids.is_empty() || removed_runs > 0 || removed_crews > 0 {
        let _ = app.emit("data-changed", "");
    }

    CompactReport {
        compacted_at,
        removed_workers: removed_worker_ids.len(),
        removed_runs,
        removed_crews,
    }
}
