use tauri::State;

use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::convoy::{Convoy, ConvoyStatus, MergeStrategy};
use crate::state::AppState;

pub(crate) fn create_convoy_internal(
    state: &AppState,
    title: String,
    description: String,
    rig_ids: Vec<String>,
    source: Option<&str>,
) -> Convoy {
    let convoy = Convoy::new(title, description, rig_ids.clone());
    let mut convoys = state.convoys.lock().unwrap();
    convoys.push(convoy.clone());
    state.save_convoys(&convoys);
    drop(convoys);

    let rig_id = rig_ids.first().cloned().unwrap_or_default();
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        None,
        None,
        AuditEventType::ConvoyCreated,
        serde_json::json!({
            "convoy_id": convoy.convoy_id,
            "title": convoy.title,
            "rig_ids": convoy.rig_ids,
            "source": source.unwrap_or("ui"),
        })
        .to_string(),
    ));

    convoy
}

#[tauri::command]
pub fn list_convoys(state: State<AppState>) -> Vec<Convoy> {
    let convoys = state.convoys.lock().unwrap();
    convoys.clone()
}

#[tauri::command]
pub fn get_convoy(convoy_id: String, state: State<AppState>) -> Result<Convoy, String> {
    let convoys = state.convoys.lock().unwrap();
    convoys
        .iter()
        .find(|c| c.convoy_id == convoy_id)
        .cloned()
        .ok_or_else(|| "Convoy not found".to_string())
}

#[tauri::command]
pub fn create_convoy(
    title: String,
    description: String,
    rig_ids: Vec<String>,
    state: State<AppState>,
) -> Result<Convoy, String> {
    Ok(create_convoy_internal(
        &state,
        title,
        description,
        rig_ids,
        Some("ui"),
    ))
}

#[tauri::command]
pub fn add_item_to_convoy(
    convoy_id: String,
    work_item_id: String,
    state: State<AppState>,
) -> Result<Convoy, String> {
    let mut convoys = state.convoys.lock().unwrap();
    let convoy = convoys
        .iter_mut()
        .find(|c| c.convoy_id == convoy_id)
        .ok_or_else(|| "Convoy not found".to_string())?;

    if !convoy.work_item_ids.contains(&work_item_id) {
        convoy.work_item_ids.push(work_item_id.clone());
        convoy.updated_at = chrono::Utc::now().to_rfc3339();
    }
    let updated = convoy.clone();
    state.save_convoys(&convoys);
    drop(convoys);

    // Also link the task to this convoy
    {
        let mut tasks = state.tasks.lock().unwrap();
        if let Some(task) = tasks.iter_mut().find(|t| t.id == work_item_id) {
            task.apply_update(crate::models::task::TaskUpdateRequest {
                title: None,
                description: None,
                tags: None,
                priority: None,
                status: None,
                assigned_worker_id: None,
                acceptance_criteria: None,
                dependencies: None,
                owner_actor_id: None,
                convoy_id: Some(Some(convoy_id.clone())),
                hook_id: None,
                blocked_reason: None,
                outcome: None,
            });
            state.save_tasks(&tasks);
        }
    }

    let rig_id = updated.rig_ids.first().cloned().unwrap_or_default();
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        None,
        Some(work_item_id),
        AuditEventType::ConvoyUpdated,
        serde_json::json!({
            "convoy_id": updated.convoy_id,
            "action": "add_item",
        })
        .to_string(),
    ));

    Ok(updated)
}

/// Extended create that supports ownership and merge strategy — mirrors `gt convoy create --owned --merge`.
#[tauri::command]
pub fn create_convoy_v2(
    title: String,
    description: String,
    rig_ids: Vec<String>,
    owned: bool,
    merge_strategy: Option<MergeStrategy>,
    owner_actor_id: Option<String>,
    state: State<AppState>,
) -> Result<Convoy, String> {
    let mut convoy = create_convoy_internal(&state, title, description, rig_ids, Some("ui_v2"));
    convoy.owned = owned;
    convoy.owner_actor_id = owner_actor_id.clone();
    convoy.merge_strategy = merge_strategy.unwrap_or_default();

    // Persist the updated ownership fields
    let mut convoys = state.convoys.lock().unwrap();
    if let Some(c) = convoys.iter_mut().find(|c| c.convoy_id == convoy.convoy_id) {
        c.owned = convoy.owned;
        c.owner_actor_id = convoy.owner_actor_id.clone();
        c.merge_strategy = convoy.merge_strategy.clone();
    }
    state.save_convoys(&convoys);
    drop(convoys);

    Ok(convoy)
}

/// Land an owned convoy: mark all open work items as Done, close convoy as Completed.
/// Mirrors `gt convoy land`.
#[tauri::command]
pub fn convoy_land(
    convoy_id: String,
    land_notes: Option<String>,
    state: State<AppState>,
) -> Result<Convoy, String> {
    // Collect work_item_ids + rig first
    let (work_item_ids, rig_id) = {
        let convoys = state.convoys.lock().unwrap();
        let c = convoys
            .iter()
            .find(|c| c.convoy_id == convoy_id)
            .ok_or_else(|| "Convoy not found".to_string())?;
        if !c.owned {
            return Err("convoy_land is only valid for owned convoys".to_string());
        }
        (c.work_item_ids.clone(), c.rig_ids.first().cloned().unwrap_or_default())
    };

    // Mark all open tasks as Done
    {
        let mut tasks = state.tasks.lock().unwrap();
        for task in tasks.iter_mut() {
            if work_item_ids.contains(&task.id)
                && task.status != crate::models::task::TaskStatus::Done
                && task.status != crate::models::task::TaskStatus::Cancelled
            {
                task.status = crate::models::task::TaskStatus::Done;
                task.completed_at = Some(chrono::Utc::now().to_rfc3339());
                state.append_audit_event(&AuditEvent::new(
                    task.rig_id.clone(),
                    None,
                    Some(task.id.clone()),
                    AuditEventType::TaskUpdated,
                    serde_json::json!({
                        "action": "convoy_land_auto_close",
                        "convoy_id": convoy_id,
                    })
                    .to_string(),
                ));
            }
        }
        state.save_tasks(&tasks);
    }

    // Close convoy
    let updated = {
        let mut convoys = state.convoys.lock().unwrap();
        let c = convoys
            .iter_mut()
            .find(|c| c.convoy_id == convoy_id)
            .ok_or_else(|| "Convoy not found".to_string())?;
        c.status = ConvoyStatus::Completed;
        c.completed_at = Some(chrono::Utc::now().to_rfc3339());
        c.updated_at = chrono::Utc::now().to_rfc3339();
        c.land_notes = land_notes.clone();
        let u = c.clone();
        state.save_convoys(&convoys);
        u
    };

    state.append_audit_event(&AuditEvent::new(
        rig_id,
        None,
        None,
        AuditEventType::ConvoyCompleted,
        serde_json::json!({
            "convoy_id": convoy_id,
            "action": "convoy_land",
            "land_notes": land_notes,
        })
        .to_string(),
    ));

    Ok(updated)
}
#[tauri::command]
pub fn update_convoy_status(
    convoy_id: String,
    status: ConvoyStatus,
    state: State<AppState>,
) -> Result<Convoy, String> {
    let mut convoys = state.convoys.lock().unwrap();
    let convoy = convoys
        .iter_mut()
        .find(|c| c.convoy_id == convoy_id)
        .ok_or_else(|| "Convoy not found".to_string())?;

    convoy.status = status.clone();
    convoy.updated_at = chrono::Utc::now().to_rfc3339();
    if status == ConvoyStatus::Completed {
        convoy.completed_at = Some(chrono::Utc::now().to_rfc3339());
    }
    let updated = convoy.clone();
    state.save_convoys(&convoys);
    drop(convoys);

    let audit_type = if status == ConvoyStatus::Completed {
        AuditEventType::ConvoyCompleted
    } else {
        AuditEventType::ConvoyUpdated
    };
    let rig_id = updated.rig_ids.first().cloned().unwrap_or_default();
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        None,
        None,
        audit_type,
        serde_json::json!({
            "convoy_id": updated.convoy_id,
            "new_status": updated.status,
        })
        .to_string(),
    ));

    Ok(updated)
}
