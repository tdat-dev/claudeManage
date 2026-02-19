use serde::Serialize;
use tauri::State;

use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::task::{Task, TaskPriority, TaskStatus, TaskUpdateRequest};
use crate::models::worker::WorkerStatusEnum;
use crate::state::AppState;

#[tauri::command]
pub fn list_tasks(rig_id: String, state: State<AppState>) -> Vec<Task> {
    let tasks = state.tasks.lock().unwrap();
    tasks.iter().filter(|t| t.rig_id == rig_id).cloned().collect()
}

#[tauri::command]
pub fn create_task(
    rig_id: String,
    title: String,
    description: String,
    tags: Vec<String>,
    priority: TaskPriority,
    acceptance_criteria: Option<String>,
    state: State<AppState>,
) -> Task {
    let task = Task::new(rig_id.clone(), title, description, tags, priority, acceptance_criteria);
    let mut tasks = state.tasks.lock().unwrap();
    tasks.push(task.clone());
    state.save_tasks(&tasks);

    // Audit
    let payload = serde_json::json!({
        "title": &task.title,
        "priority": &task.priority,
    }).to_string();
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        None,
        Some(task.id.clone()),
        AuditEventType::TaskCreated,
        payload,
    ));

    task
}

#[tauri::command]
pub fn update_task(
    id: String,
    updates: TaskUpdateRequest,
    state: State<AppState>,
) -> Result<Task, String> {
    let mut tasks = state.tasks.lock().unwrap();
    let task = tasks
        .iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| "Task not found".to_string())?;

    let old_status = task.status.clone();
    task.apply_update(updates);
    let updated = task.clone();
    state.save_tasks(&tasks);

    // Audit — status change or generic update
    let event_type = if updated.status != old_status {
        AuditEventType::TaskStatusChanged
    } else {
        AuditEventType::TaskUpdated
    };
    let payload = serde_json::json!({
        "old_status": old_status,
        "new_status": &updated.status,
        "title": &updated.title,
    }).to_string();
    state.append_audit_event(&AuditEvent::new(
        updated.rig_id.clone(),
        None,
        Some(updated.id.clone()),
        event_type,
        payload,
    ));

    Ok(updated)
}

#[tauri::command]
pub fn delete_task(id: String, state: State<AppState>) -> Result<(), String> {
    let mut tasks = state.tasks.lock().unwrap();
    let task = tasks.iter().find(|t| t.id == id).cloned();
    let len_before = tasks.len();
    tasks.retain(|t| t.id != id);
    if tasks.len() == len_before {
        return Err("Task not found".to_string());
    }
    state.save_tasks(&tasks);

    // Audit
    if let Some(t) = task {
        let payload = serde_json::json!({ "title": &t.title }).to_string();
        state.append_audit_event(&AuditEvent::new(
            t.rig_id,
            None,
            Some(t.id),
            AuditEventType::TaskDeleted,
            payload,
        ));
    }

    Ok(())
}

// ── Health metrics ──

#[derive(Debug, Clone, Serialize)]
pub struct HealthMetrics {
    pub total_tasks: usize,
    pub todo: usize,
    pub in_progress: usize,
    pub blocked: usize,
    pub escalated: usize,
    pub deferred: usize,
    pub done: usize,
    pub cancelled: usize,
    pub stuck_tasks: Vec<StuckTaskInfo>,
    pub workers_running: usize,
    pub workers_failed: usize,
    pub workers_total: usize,
    pub hooks_idle: usize,
    pub hooks_assigned: usize,
    pub hooks_running: usize,
    pub handoffs_pending: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct StuckTaskInfo {
    pub task_id: String,
    pub title: String,
    pub minutes_stuck: i64,
    pub assigned_worker_id: Option<String>,
}

#[tauri::command]
pub fn get_health_metrics(rig_id: String, stuck_threshold_minutes: Option<i64>, state: State<AppState>) -> HealthMetrics {
    let tasks = state.tasks.lock().unwrap();
    let workers = state.workers.lock().unwrap();
    let hooks = state.hooks.lock().unwrap();
    let handoffs = state.handoffs.lock().unwrap();

    let rig_tasks: Vec<&Task> = tasks.iter().filter(|t| t.rig_id == rig_id).collect();
    let threshold = stuck_threshold_minutes.unwrap_or(30);
    let now = chrono::Utc::now();

    let mut stuck_tasks = Vec::new();
    for task in &rig_tasks {
        if task.status == TaskStatus::InProgress {
            if let Ok(updated) = chrono::DateTime::parse_from_rfc3339(&task.updated_at) {
                let minutes = (now - updated.with_timezone(&chrono::Utc)).num_minutes();
                if minutes >= threshold {
                    stuck_tasks.push(StuckTaskInfo {
                        task_id: task.id.clone(),
                        title: task.title.clone(),
                        minutes_stuck: minutes,
                        assigned_worker_id: task.assigned_worker_id.clone(),
                    });
                }
            }
        }
    }

    HealthMetrics {
        total_tasks: rig_tasks.len(),
        todo: rig_tasks.iter().filter(|t| t.status == TaskStatus::Todo).count(),
        in_progress: rig_tasks.iter().filter(|t| t.status == TaskStatus::InProgress).count(),
        blocked: rig_tasks.iter().filter(|t| t.status == TaskStatus::Blocked).count(),
        escalated: rig_tasks.iter().filter(|t| t.status == TaskStatus::Escalated).count(),
        deferred: rig_tasks.iter().filter(|t| t.status == TaskStatus::Deferred).count(),
        done: rig_tasks.iter().filter(|t| t.status == TaskStatus::Done).count(),
        cancelled: rig_tasks.iter().filter(|t| t.status == TaskStatus::Cancelled).count(),
        stuck_tasks,
        workers_running: workers.iter().filter(|w| w.rig_id == rig_id && w.status == WorkerStatusEnum::Running).count(),
        workers_failed: workers.iter().filter(|w| w.rig_id == rig_id && w.status == WorkerStatusEnum::Failed).count(),
        workers_total: workers.iter().filter(|w| w.rig_id == rig_id).count(),
        hooks_idle: hooks.iter().filter(|h| h.rig_id == rig_id && h.status == crate::models::hook::HookStatus::Idle).count(),
        hooks_assigned: hooks.iter().filter(|h| h.rig_id == rig_id && h.status == crate::models::hook::HookStatus::Assigned).count(),
        hooks_running: hooks.iter().filter(|h| h.rig_id == rig_id && h.status == crate::models::hook::HookStatus::Running).count(),
        handoffs_pending: handoffs.iter().filter(|h| h.rig_id == rig_id && h.status == crate::models::handoff::HandoffStatus::Pending).count(),
    }
}

/// Auto-escalate stuck tasks (in_progress for too long)
#[tauri::command]
pub fn escalate_stuck_tasks(rig_id: String, threshold_minutes: Option<i64>, state: State<AppState>) -> Vec<Task> {
    let threshold = threshold_minutes.unwrap_or(30);
    let now = chrono::Utc::now();
    let mut tasks = state.tasks.lock().unwrap();
    let mut escalated = Vec::new();

    for task in tasks.iter_mut() {
        if task.rig_id != rig_id || task.status != TaskStatus::InProgress {
            continue;
        }
        if let Ok(updated) = chrono::DateTime::parse_from_rfc3339(&task.updated_at) {
            let minutes = (now - updated.with_timezone(&chrono::Utc)).num_minutes();
            if minutes >= threshold {
                task.status = TaskStatus::Escalated;
                task.blocked_reason = Some(format!("Auto-escalated: stuck for {} minutes", minutes));
                task.updated_at = now.to_rfc3339();
                escalated.push(task.clone());

                // Audit
                let payload = serde_json::json!({
                    "title": &task.title,
                    "old_status": "in_progress",
                    "new_status": "escalated",
                    "minutes_stuck": minutes,
                }).to_string();
                state.append_audit_event(&AuditEvent::new(
                    task.rig_id.clone(),
                    None,
                    Some(task.id.clone()),
                    AuditEventType::TaskStatusChanged,
                    payload,
                ));
            }
        }
    }

    if !escalated.is_empty() {
        state.save_tasks(&tasks);
    }

    escalated
}
