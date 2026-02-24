use serde::Serialize;
use tauri::State;

use crate::models::dog::{Dog, DogRole, DogStatus};
use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::hook::HookStatus;
use crate::models::task::TaskStatus;
use crate::models::worker::WorkerStatusEnum;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct DogPoolStatus {
    pub total_dogs: usize,
    pub running: usize,
    pub completed: usize,
    pub failed: usize,
}

#[tauri::command]
pub fn list_dogs(state: State<AppState>) -> Vec<Dog> {
    state.dogs.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_dog_pool_status(state: State<AppState>) -> DogPoolStatus {
    let dogs = state.dogs.lock().unwrap();
    DogPoolStatus {
        total_dogs: dogs.len(),
        running: dogs.iter().filter(|d| d.status == DogStatus::Running).count(),
        completed: dogs.iter().filter(|d| d.status == DogStatus::Completed).count(),
        failed: dogs.iter().filter(|d| d.status == DogStatus::Failed).count(),
    }
}

/// Spawn a dog for a specific role and run it synchronously.
/// Dogs are short-lived, so they run inline and return their result immediately.
#[tauri::command]
pub fn spawn_dog(role: DogRole, rig_id: Option<String>, state: State<AppState>) -> Result<Dog, String> {
    let mut dog = Dog::new(role.clone(), rig_id.clone());
    dog.status = DogStatus::Running;

    {
        let mut dogs = state.dogs.lock().unwrap();
        dogs.push(dog.clone());
    }

    // Execute the dog task inline
    let result = run_dog_task(&state, &mut dog);

    // Finalise
    dog.finished_at = Some(chrono::Utc::now().to_rfc3339());
    dog.status = match &result {
        Ok(_) => DogStatus::Completed,
        Err(_) => DogStatus::Failed,
    };
    dog.result_summary = Some(result.unwrap_or_else(|e| format!("ERROR: {}", e)));

    {
        let mut dogs = state.dogs.lock().unwrap();
        if let Some(d) = dogs.iter_mut().find(|d| d.dog_id == dog.dog_id) {
            d.status = dog.status.clone();
            d.finished_at = dog.finished_at.clone();
            d.result_summary = dog.result_summary.clone();
        }
    }

    state.append_audit_event(&AuditEvent::new(
        rig_id.unwrap_or_default(),
        None,
        None,
        AuditEventType::WorkerCompleted,
        serde_json::json!({
            "dog_id": dog.dog_id,
            "role": dog.role.to_string(),
            "status": format!("{:?}", dog.status),
            "summary": dog.result_summary,
        })
        .to_string(),
    ));

    Ok(dog)
}

/// Prune dog records older than 24 h to keep the pool from growing unbounded.
#[tauri::command]
pub fn prune_dogs(state: State<AppState>) -> usize {
    let cutoff = chrono::Utc::now() - chrono::Duration::hours(24);
    let mut dogs = state.dogs.lock().unwrap();
    let before = dogs.len();
    dogs.retain(|d| {
        if d.status == DogStatus::Running { return true; }
        let finish = d.finished_at.as_deref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
        finish.map(|t| t.with_timezone(&chrono::Utc) > cutoff).unwrap_or(true)
    });
    before - dogs.len()
}

// ── Internal dog task implementations ──

fn run_dog_task(state: &AppState, dog: &Dog) -> Result<String, String> {
    match dog.role {
        DogRole::Boot => dog_boot(state),
        DogRole::HealthCheck => dog_health_check(state, dog.rig_id.as_deref()),
        DogRole::LogRotation => dog_log_rotation(state),
        DogRole::OrphanCleanup => dog_orphan_cleanup(state, dog.rig_id.as_deref()),
        DogRole::HookRepair => dog_hook_repair(state, dog.rig_id.as_deref()),
    }
}

fn dog_boot(state: &AppState) -> Result<String, String> {
    let workers_running = state
        .workers.lock().unwrap()
        .iter()
        .filter(|w| w.status == WorkerStatusEnum::Running)
        .count();
    let hooks_open = state
        .hooks.lock().unwrap()
        .iter()
        .filter(|h| h.status == HookStatus::Assigned || h.status == HookStatus::Running)
        .count();
    let pending_tasks = state
        .tasks.lock().unwrap()
        .iter()
        .filter(|t| t.status == TaskStatus::Todo || t.status == TaskStatus::InProgress)
        .count();

    Ok(format!(
        "Boot check OK — workers_running={}, hooks_open={}, pending_tasks={}",
        workers_running, hooks_open, pending_tasks
    ))
}

fn dog_health_check(state: &AppState, rig_id: Option<&str>) -> Result<String, String> {
    let mut crashed = 0usize;
    let mut workers = state.workers.lock().unwrap();
    for w in workers.iter_mut() {
        if rig_id.map(|rid| w.rig_id != rid).unwrap_or(false) { continue; }
        if w.status == WorkerStatusEnum::Running {
            // Simple liveness check: if pid is gone, mark as failed
            if let Some(pid) = w.pid {
                #[cfg(target_os = "windows")]
                let alive = {
                    let out = std::process::Command::new("tasklist")
                        .args(["/FI", &format!("PID eq {}", pid), "/NH"])
                        .output()
                        .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
                        .unwrap_or(false);
                    out
                };
                #[cfg(not(target_os = "windows"))]
                let alive = std::path::Path::new(&format!("/proc/{}", pid)).exists();

                if !alive {
                    w.status = WorkerStatusEnum::Failed;
                    w.stopped_at = Some(chrono::Utc::now().to_rfc3339());
                    crashed += 1;
                }
            }
        }
    }
    if crashed > 0 {
        state.save_workers(&workers);
    }
    Ok(format!("Health check done — marked {} crashed workers as failed", crashed))
}

fn dog_log_rotation(state: &AppState) -> Result<String, String> {
    let log_dir = state.town_dir.join("logs");
    let threshold_bytes: u64 = 5 * 1024 * 1024; // 5 MB
    let mut rotated = 0usize;

    if let Ok(entries) = std::fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.len() > threshold_bytes {
                    let path = entry.path();
                    let archive = path.with_extension("jsonl.gz_bak");
                    // Basic rename to .bak (no real compression; just caps unbounded growth)
                    let _ = std::fs::rename(&path, &archive);
                    rotated += 1;
                }
            }
        }
    }
    Ok(format!("Log rotation done — rotated {} large log files", rotated))
}

fn dog_orphan_cleanup(state: &AppState, rig_id: Option<&str>) -> Result<String, String> {
    let running_worker_ids: std::collections::HashSet<String> = {
        let workers = state.workers.lock().unwrap();
        workers.iter()
            .filter(|w| w.status == WorkerStatusEnum::Running)
            .map(|w| w.id.clone())
            .collect()
    };

    let mut fixed = 0usize;
    let mut tasks = state.tasks.lock().unwrap();
    for task in tasks.iter_mut() {
        if rig_id.map(|rid| task.rig_id != rid).unwrap_or(false) { continue; }
        if task.status == TaskStatus::InProgress {
            let is_orphan = task.assigned_worker_id
                .as_ref()
                .map(|wid| !running_worker_ids.contains(wid))
                .unwrap_or(true); // no worker assigned but in_progress = orphan
            if is_orphan {
                task.status = TaskStatus::Todo;
                task.assigned_worker_id = None;
                fixed += 1;
            }
        }
    }
    if fixed > 0 {
        state.save_tasks(&tasks);
    }
    Ok(format!("Orphan cleanup done — reset {} orphaned in-progress tasks to todo", fixed))
}

fn dog_hook_repair(state: &AppState, rig_id: Option<&str>) -> Result<String, String> {
    let task_ids: std::collections::HashSet<String> = {
        let tasks = state.tasks.lock().unwrap();
        tasks.iter().map(|t| t.id.clone()).collect()
    };

    let mut repaired = 0usize;
    let mut hooks = state.hooks.lock().unwrap();
    for hook in hooks.iter_mut() {
        if rig_id.map(|rid| hook.rig_id != rid).unwrap_or(false) { continue; }
        if let Some(work_id) = &hook.current_work_id {
            if !task_ids.contains(work_id) {
                // Task gone — clear hook
                hook.current_work_id = None;
                hook.status = HookStatus::Idle;
                repaired += 1;
            }
        }
    }
    if repaired > 0 {
        state.save_hooks(&hooks);
    }
    Ok(format!("Hook repair done — cleared {} stale hook references", repaired))
}
