use tauri::State;

use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::task::{Task, TaskPriority, TaskUpdateRequest};
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
