use tauri::{AppHandle, State};

use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::hook::{Hook, HookStatus};
use crate::models::task::{TaskStatus, TaskUpdateRequest};
use crate::state::AppState;

#[tauri::command]
pub fn list_hooks(rig_id: String, state: State<AppState>) -> Vec<Hook> {
    let hooks = state.hooks.lock().unwrap();
    hooks.iter().filter(|h| h.rig_id == rig_id).cloned().collect()
}

#[tauri::command]
pub fn create_hook(
    rig_id: String,
    attached_actor_id: String,
    state: State<AppState>,
) -> Result<Hook, String> {
    // ensure rig exists
    {
        let rigs = state.rigs.lock().unwrap();
        if !rigs.iter().any(|r| r.id == rig_id) {
            return Err("Rig not found".to_string());
        }
    }

    let hook = Hook::new(rig_id.clone(), attached_actor_id.clone());
    let mut hooks = state.hooks.lock().unwrap();
    hooks.push(hook.clone());
    state.save_hooks(&hooks);

    let payload = serde_json::json!({
        "hook_id": hook.hook_id,
        "attached_actor_id": attached_actor_id,
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        Some(hook.attached_actor_id.clone()),
        None,
        AuditEventType::HookCreated,
        payload,
    ));

    Ok(hook)
}

#[tauri::command]
pub fn assign_to_hook(
    hook_id: String,
    work_item_id: String,
    state_blob: Option<String>,
    state: State<AppState>,
) -> Result<Hook, String> {
    let mut hooks = state.hooks.lock().unwrap();
    let hook = hooks
        .iter_mut()
        .find(|h| h.hook_id == hook_id)
        .ok_or_else(|| "Hook not found".to_string())?;

    hook.current_work_id = Some(work_item_id.clone());
    hook.state_blob = state_blob.clone();
    hook.status = HookStatus::Assigned;
    hook.last_heartbeat = chrono::Utc::now().to_rfc3339();
    let updated = hook.clone();
    state.save_hooks(&hooks);

    let payload = serde_json::json!({
        "hook_id": updated.hook_id,
        "work_item_id": work_item_id,
        "has_state_blob": state_blob.is_some(),
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        updated.rig_id.clone(),
        Some(updated.attached_actor_id.clone()),
        updated.current_work_id.clone(),
        AuditEventType::HookAssigned,
        payload,
    ));

    Ok(updated)
}

#[tauri::command]
pub fn sling(
    hook_id: String,
    work_item_id: String,
    state_blob: Option<String>,
    state: State<AppState>,
) -> Result<Hook, String> {
    // update hook first
    let mut hooks = state.hooks.lock().unwrap();
    let hook = hooks
        .iter_mut()
        .find(|h| h.hook_id == hook_id)
        .ok_or_else(|| "Hook not found".to_string())?;

    hook.current_work_id = Some(work_item_id.clone());
    hook.state_blob = state_blob.clone();
    hook.status = HookStatus::Running;
    hook.last_heartbeat = chrono::Utc::now().to_rfc3339();
    let updated = hook.clone();
    state.save_hooks(&hooks);
    drop(hooks);

    // immediately mark task in-progress and link to hook
    {
        let mut tasks = state.tasks.lock().unwrap();
        if let Some(task) = tasks.iter_mut().find(|t| t.id == work_item_id) {
            task.apply_update(TaskUpdateRequest {
                title: None,
                description: None,
                tags: None,
                priority: None,
                status: Some(TaskStatus::InProgress),
                assigned_worker_id: None,
                acceptance_criteria: None,
                dependencies: None,
                owner_actor_id: Some(Some(updated.attached_actor_id.clone())),
                convoy_id: None,
                hook_id: Some(Some(updated.hook_id.clone())),
                blocked_reason: Some(None),
                outcome: None,
            });
            state.save_tasks(&tasks);
        }
    }

    let payload = serde_json::json!({
        "hook_id": updated.hook_id,
        "work_item_id": work_item_id,
        "has_state_blob": state_blob.is_some(),
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        updated.rig_id.clone(),
        Some(updated.attached_actor_id.clone()),
        updated.current_work_id.clone(),
        AuditEventType::HookSlung,
        payload,
    ));

    Ok(updated)
}

#[tauri::command]
pub fn done(hook_id: String, outcome: Option<String>, state: State<AppState>) -> Result<Hook, String> {
    let mut hooks = state.hooks.lock().unwrap();
    let hook = hooks
        .iter_mut()
        .find(|h| h.hook_id == hook_id)
        .ok_or_else(|| "Hook not found".to_string())?;

    let work_item_id = hook.current_work_id.clone();
    hook.status = HookStatus::Done;
    hook.last_heartbeat = chrono::Utc::now().to_rfc3339();
    let updated = hook.clone();
    state.save_hooks(&hooks);
    drop(hooks);

    // update task outcome/done if there is current work item
    if let Some(task_id) = &work_item_id {
        let mut tasks = state.tasks.lock().unwrap();
        if let Some(task) = tasks.iter_mut().find(|t| t.id == *task_id) {
            task.apply_update(TaskUpdateRequest {
                title: None,
                description: None,
                tags: None,
                priority: None,
                status: Some(TaskStatus::Done),
                assigned_worker_id: None,
                acceptance_criteria: None,
                dependencies: None,
                owner_actor_id: None,
                convoy_id: None,
                hook_id: Some(Some(updated.hook_id.clone())),
                blocked_reason: Some(None),
                outcome: Some(outcome.clone()),
            });
            state.save_tasks(&tasks);
        }
    }

    // then reset current work (hook goes idle after done)
    let mut hooks = state.hooks.lock().unwrap();
    if let Some(h) = hooks.iter_mut().find(|h| h.hook_id == updated.hook_id) {
        h.current_work_id = None;
        h.state_blob = None;
        h.status = HookStatus::Idle;
        h.last_heartbeat = chrono::Utc::now().to_rfc3339();
    }
    let final_hook = hooks
        .iter()
        .find(|h| h.hook_id == updated.hook_id)
        .cloned()
        .ok_or_else(|| "Hook not found".to_string())?;
    state.save_hooks(&hooks);

    let payload = serde_json::json!({
        "hook_id": final_hook.hook_id,
        "work_item_id": work_item_id,
        "outcome": outcome,
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        final_hook.rig_id.clone(),
        Some(final_hook.attached_actor_id.clone()),
        work_item_id,
        AuditEventType::HookDone,
        payload,
    ));

    Ok(final_hook)
}

#[tauri::command]
pub fn resume_hook(hook_id: String, state: State<AppState>, app: AppHandle) -> Result<Hook, String> {
    let mut hooks = state.hooks.lock().unwrap();
    let hook = hooks
        .iter_mut()
        .find(|h| h.hook_id == hook_id)
        .ok_or_else(|| "Hook not found".to_string())?;

    hook.status = if hook.current_work_id.is_some() {
        HookStatus::Running
    } else {
        HookStatus::Assigned
    };
    hook.last_heartbeat = chrono::Utc::now().to_rfc3339();
    let updated = hook.clone();
    state.save_hooks(&hooks);
    drop(hooks);

    // Build a resume prompt from state_blob
    let resume_prompt = if let Some(ref blob) = updated.state_blob {
        format!(
            "[RESUME] Continuing interrupted work. Previous state:\n{}\n\nPlease continue where you left off.",
            blob
        )
    } else {
        "[RESUME] Continuing interrupted work. No previous state available. Please check the current project state and continue.".to_string()
    };

    // Find a crew in the same rig to spawn a worker in
    let crew_id = {
        let crews = state.crews.lock().unwrap();
        crews
            .iter()
            .find(|c| c.rig_id == updated.rig_id && c.status == crate::models::crew::CrewStatus::Active)
            .map(|c| c.id.clone())
            .ok_or_else(|| "No active crew found in this rig to resume work".to_string())?
    };

    // Use the actor_id as agent_type for the spawned worker
    let agent_type = updated.attached_actor_id.clone();

    // Audit: hook resumed
    let payload = serde_json::json!({
        "hook_id": updated.hook_id,
        "work_item_id": updated.current_work_id,
        "has_state_blob": updated.state_blob.is_some(),
        "spawning_worker": true,
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        updated.rig_id.clone(),
        Some(updated.attached_actor_id.clone()),
        updated.current_work_id.clone(),
        AuditEventType::HookResumed,
        payload,
    ));

    // Spawn a worker to continue the work
    match super::workers::spawn_worker(crew_id, agent_type, resume_prompt, app) {
        Ok(worker) => {
            // Link the worker to the hook's current work item if any
            if let Some(ref task_id) = updated.current_work_id {
                let mut tasks = state.tasks.lock().unwrap();
                if let Some(task) = tasks.iter_mut().find(|t| t.id == *task_id) {
                    task.apply_update(TaskUpdateRequest {
                        title: None,
                        description: None,
                        tags: None,
                        priority: None,
                        status: Some(TaskStatus::InProgress),
                        assigned_worker_id: Some(Some(worker.id.clone())),
                        acceptance_criteria: None,
                        dependencies: None,
                        owner_actor_id: None,
                        convoy_id: None,
                        hook_id: Some(Some(updated.hook_id.clone())),
                        blocked_reason: Some(None),
                        outcome: None,
                    });
                    state.save_tasks(&tasks);
                }
            }
            // Return the updated hook
            let hooks = state.hooks.lock().unwrap();
            hooks
                .iter()
                .find(|h| h.hook_id == updated.hook_id)
                .cloned()
                .ok_or_else(|| "Hook not found after resume".to_string())
        }
        Err(e) => Err(format!("Resume hook: failed to spawn worker: {}", e)),
    }
}
