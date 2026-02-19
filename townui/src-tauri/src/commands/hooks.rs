use tauri::{AppHandle, State};

use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::hook::{Hook, HookStatus};
use crate::models::task::{TaskStatus, TaskUpdateRequest};
use crate::state::AppState;

fn resolve_active_crew_id(rig_id: &str, state: &AppState) -> Result<String, String> {
    let crews = state.crews.lock().unwrap();
    crews
        .iter()
        .find(|c| c.rig_id == rig_id && c.status == crate::models::crew::CrewStatus::Active)
        .map(|c| c.id.clone())
        .ok_or_else(|| "No active crew found in this rig to execute hook work".to_string())
}

fn resolve_hook_agent_type(hook: &Hook, state: &AppState) -> String {
    {
        let actors = state.actors.lock().unwrap();
        if let Some(actor) = actors
            .iter()
            .find(|a| a.actor_id == hook.attached_actor_id && a.rig_id == hook.rig_id)
        {
            return actor.agent_type.clone();
        }
    }

    {
        let settings = state.settings.lock().unwrap();
        if settings.cli_paths.contains_key(&hook.attached_actor_id) {
            return hook.attached_actor_id.clone();
        }
        if !settings.default_cli.trim().is_empty() {
            return settings.default_cli.clone();
        }
        if settings.cli_paths.contains_key("codex") {
            return "codex".to_string();
        }
    }

    // Safe fallback for installations that don't keep actor->agent mapping.
    "codex".to_string()
}

fn build_hook_task_prompt(
    hook: &Hook,
    work_item_id: &str,
    crew_id: &str,
    state: &AppState,
) -> Result<String, String> {
    let (task_title, task_description, acceptance_criteria) = {
        let tasks = state.tasks.lock().unwrap();
        let task = tasks
            .iter()
            .find(|t| t.id == work_item_id)
            .ok_or_else(|| "Task not found".to_string())?;
        (
            task.title.clone(),
            task.description.clone(),
            task.acceptance_criteria.clone(),
        )
    };

    let crew_branch = {
        let crews = state.crews.lock().unwrap();
        crews
            .iter()
            .find(|c| c.id == crew_id)
            .map(|c| c.branch.clone())
            .ok_or_else(|| "Crew not found".to_string())?
    };

    let (rig_name, rig_path) = {
        let rigs = state.rigs.lock().unwrap();
        rigs.iter()
            .find(|r| r.id == hook.rig_id)
            .map(|r| (r.name.clone(), r.path.clone()))
            .ok_or_else(|| "Rig not found".to_string())?
    };

    let template_name = {
        let settings = state.settings.lock().unwrap();
        settings.default_template.clone()
    };

    let title_trimmed = task_title.trim().to_string();
    let description_trimmed = task_description.trim().to_string();
    let criteria_trimmed = acceptance_criteria
        .as_ref()
        .map(|x| x.trim().to_string())
        .unwrap_or_default();

    // If this is a minimal "reply-only" task, avoid heavy coding template prompts.
    // Example: title="chao", acceptance_criteria="chao", empty description.
    if !title_trimmed.is_empty()
        && description_trimmed.is_empty()
        && !criteria_trimmed.is_empty()
        && title_trimmed.to_lowercase() == criteria_trimmed.to_lowercase()
    {
        return Ok(format!(
            "[HOOK EXECUTION]\nHook ID: {}\nActor ID: {}\nTask ID: {}\n\nReply with exactly this text and nothing else:\n{}\n\nDo not run shell commands. Do not inspect files.",
            hook.hook_id, hook.attached_actor_id, work_item_id, criteria_trimmed
        ));
    }

    let rendered = crate::templates::render_builtin_template(
        &template_name,
        &task_title,
        &task_description,
        &rig_name,
        &crew_branch,
        &rig_path,
    );

    let mut prompt = format!(
        "[HOOK EXECUTION]\nHook ID: {}\nActor ID: {}\nTask ID: {}\nThis task was slung/assigned on-hook and should start immediately.\n\n{}",
        hook.hook_id, hook.attached_actor_id, work_item_id, rendered
    );

    if let Some(criteria) = acceptance_criteria {
        prompt.push_str(&format!("\n\nAcceptance Criteria:\n{}", criteria));
    }

    Ok(prompt)
}

fn auto_execute_hook_work(
    hook: &Hook,
    work_item_id: &str,
    state: &AppState,
    app: AppHandle,
) -> Result<(String, String, String), String> {
    let crew_id = resolve_active_crew_id(&hook.rig_id, state)?;
    let agent_type = resolve_hook_agent_type(hook, state);
    let prompt = build_hook_task_prompt(hook, work_item_id, &crew_id, state)?;

    let worker = super::workers::spawn_worker(crew_id.clone(), agent_type.clone(), prompt, app)?;

    {
        let mut tasks = state.tasks.lock().unwrap();
        let task = tasks
            .iter_mut()
            .find(|t| t.id == work_item_id)
            .ok_or_else(|| "Task not found".to_string())?;
        task.apply_update(TaskUpdateRequest {
            title: None,
            description: None,
            tags: None,
            priority: None,
            status: Some(TaskStatus::InProgress),
            assigned_worker_id: Some(Some(worker.id.clone())),
            acceptance_criteria: None,
            dependencies: None,
            owner_actor_id: Some(Some(hook.attached_actor_id.clone())),
            convoy_id: None,
            hook_id: Some(Some(hook.hook_id.clone())),
            blocked_reason: Some(None),
            outcome: Some(None),
        });
        state.save_tasks(&tasks);
    }

    Ok((worker.id, crew_id, agent_type))
}

fn dispatch_hook_work(
    hook_id: String,
    work_item_id: String,
    state_blob: Option<String>,
    state: &AppState,
    app: AppHandle,
    audit_event_type: AuditEventType,
) -> Result<Hook, String> {
    let assigned_hook = {
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
        updated
    };

    match auto_execute_hook_work(&assigned_hook, &work_item_id, state, app) {
        Ok((worker_id, crew_id, agent_type)) => {
            let running_hook = {
                let mut hooks = state.hooks.lock().unwrap();
                let hook = hooks
                    .iter_mut()
                    .find(|h| h.hook_id == assigned_hook.hook_id)
                    .ok_or_else(|| "Hook not found after execute".to_string())?;
                hook.status = HookStatus::Running;
                hook.last_heartbeat = chrono::Utc::now().to_rfc3339();
                let updated = hook.clone();
                state.save_hooks(&hooks);
                updated
            };

            let payload = serde_json::json!({
                "hook_id": running_hook.hook_id,
                "work_item_id": work_item_id,
                "has_state_blob": state_blob.is_some(),
                "auto_executed": true,
                "worker_id": worker_id,
                "crew_id": crew_id,
                "agent_type": agent_type,
            })
            .to_string();
            state.append_audit_event(&AuditEvent::new(
                running_hook.rig_id.clone(),
                Some(running_hook.attached_actor_id.clone()),
                running_hook.current_work_id.clone(),
                audit_event_type,
                payload,
            ));

            Ok(running_hook)
        }
        Err(e) => {
            let err_msg = e;
            let payload = serde_json::json!({
                "hook_id": assigned_hook.hook_id,
                "work_item_id": work_item_id,
                "has_state_blob": state_blob.is_some(),
                "auto_executed": false,
                "error": err_msg.clone(),
            })
            .to_string();
            state.append_audit_event(&AuditEvent::new(
                assigned_hook.rig_id.clone(),
                Some(assigned_hook.attached_actor_id.clone()),
                assigned_hook.current_work_id.clone(),
                audit_event_type,
                payload,
            ));

            Err(format!("Hook dispatch failed to auto-execute task: {}", err_msg))
        }
    }
}

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
    app: AppHandle,
) -> Result<Hook, String> {
    dispatch_hook_work(
        hook_id,
        work_item_id,
        state_blob,
        &state,
        app,
        AuditEventType::HookAssigned,
    )
}

#[tauri::command]
pub fn sling(
    hook_id: String,
    work_item_id: String,
    state_blob: Option<String>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<Hook, String> {
    dispatch_hook_work(
        hook_id,
        work_item_id,
        state_blob,
        &state,
        app,
        AuditEventType::HookSlung,
    )
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

    // Find an active crew and resolve an agent runtime
    let crew_id = resolve_active_crew_id(&updated.rig_id, &state)?;
    let agent_type = resolve_hook_agent_type(&updated, &state);

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
