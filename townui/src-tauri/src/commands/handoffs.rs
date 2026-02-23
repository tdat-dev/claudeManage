use tauri::State;

use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::handoff::{Handoff, HandoffStatus};
use crate::models::task::TaskUpdateRequest;
use crate::state::AppState;

#[tauri::command]
pub fn list_handoffs(rig_id: String, state: State<AppState>) -> Vec<Handoff> {
    let handoffs = state.handoffs.lock().unwrap();
    handoffs
        .iter()
        .filter(|h| h.rig_id == rig_id)
        .cloned()
        .collect()
}

#[tauri::command]
pub fn create_handoff(
    rig_id: String,
    from_actor_id: String,
    to_actor_id: String,
    work_item_id: String,
    context_summary: String,
    blockers: Vec<String>,
    next_steps: Vec<String>,
    state: State<AppState>,
) -> Result<Handoff, String> {
    // ensure rig exists
    {
        let rigs = state.rigs.lock().unwrap();
        if !rigs.iter().any(|r| r.id == rig_id) {
            return Err("Rig not found".to_string());
        }
    }

    let handoff = Handoff::new(
        rig_id.clone(),
        from_actor_id.clone(),
        to_actor_id.clone(),
        work_item_id.clone(),
        context_summary,
        blockers,
        next_steps,
    );

    let mut handoffs = state.handoffs.lock().unwrap();
    handoffs.push(handoff.clone());
    state.save_handoffs(&handoffs);

    // annotate task owner with target actor
    {
        let mut tasks = state.tasks.lock().unwrap();
        if let Some(task) = tasks.iter_mut().find(|t| t.id == work_item_id) {
            task.apply_update(TaskUpdateRequest {
                title: None,
                description: None,
                tags: None,
                priority: None,
                status: None,
                assigned_worker_id: None,
                acceptance_criteria: None,
                dependencies: None,
                owner_actor_id: Some(Some(to_actor_id.clone())),
                convoy_id: None,
                hook_id: None,
                blocked_reason: None,
                outcome: None,
            });
            state.save_tasks(&tasks);
        }
    }

    let payload = serde_json::json!({
        "handoff_id": handoff.handoff_id,
        "from_actor_id": from_actor_id,
        "to_actor_id": to_actor_id,
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        Some(handoff.from_actor_id.clone()),
        Some(handoff.work_item_id.clone()),
        AuditEventType::HandoffCreated,
        payload,
    ));

    Ok(handoff)
}

#[tauri::command]
pub fn accept_handoff(
    handoff_id: String,
    accepted_by_actor_id: Option<String>,
    state: State<AppState>,
) -> Result<Handoff, String> {
    let mut handoffs = state.handoffs.lock().unwrap();
    let handoff = handoffs
        .iter_mut()
        .find(|h| h.handoff_id == handoff_id)
        .ok_or_else(|| "Handoff not found".to_string())?;

    handoff.status = HandoffStatus::Accepted;
    handoff.accepted_at = Some(chrono::Utc::now().to_rfc3339());
    let updated = handoff.clone();
    state.save_handoffs(&handoffs);

    // update task owner (fallback to handoff.to_actor_id)
    let owner = accepted_by_actor_id.unwrap_or_else(|| updated.to_actor_id.clone());
    {
        let mut tasks = state.tasks.lock().unwrap();
        if let Some(task) = tasks.iter_mut().find(|t| t.id == updated.work_item_id) {
            task.apply_update(TaskUpdateRequest {
                title: None,
                description: None,
                tags: None,
                priority: None,
                status: None,
                assigned_worker_id: None,
                acceptance_criteria: None,
                dependencies: None,
                owner_actor_id: Some(Some(owner.clone())),
                convoy_id: None,
                hook_id: None,
                blocked_reason: None,
                outcome: None,
            });
            state.save_tasks(&tasks);
        }
    }

    let payload = serde_json::json!({
        "handoff_id": updated.handoff_id,
        "accepted_by_actor_id": owner,
        "accepted_at": updated.accepted_at,
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        updated.rig_id.clone(),
        Some(updated.to_actor_id.clone()),
        Some(updated.work_item_id.clone()),
        AuditEventType::HandoffAccepted,
        payload,
    ));

    Ok(updated)
}

#[tauri::command]
pub fn reject_handoff(
    handoff_id: String,
    reason: Option<String>,
    state: State<AppState>,
) -> Result<Handoff, String> {
    let mut handoffs = state.handoffs.lock().unwrap();
    let handoff = handoffs
        .iter_mut()
        .find(|h| h.handoff_id == handoff_id)
        .ok_or_else(|| "Handoff not found".to_string())?;

    if handoff.status != HandoffStatus::Pending {
        return Err("Only pending handoffs can be rejected".to_string());
    }

    handoff.status = HandoffStatus::Rejected;
    handoff.rejected_at = Some(chrono::Utc::now().to_rfc3339());
    handoff.rejected_reason = reason.clone();
    let updated = handoff.clone();
    state.save_handoffs(&handoffs);

    let payload = serde_json::json!({
        "handoff_id": updated.handoff_id,
        "rejected_reason": reason,
        "rejected_at": updated.rejected_at,
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        updated.rig_id.clone(),
        Some(updated.to_actor_id.clone()),
        Some(updated.work_item_id.clone()),
        AuditEventType::HandoffRejected,
        payload,
    ));

    Ok(updated)
}

/// Export a handoff as a machine-readable JSON artifact string.
#[tauri::command]
pub fn export_handoff(
    handoff_id: String,
    state: State<AppState>,
) -> Result<String, String> {
    let handoffs = state.handoffs.lock().unwrap();
    let handoff = handoffs
        .iter()
        .find(|h| h.handoff_id == handoff_id)
        .ok_or_else(|| "Handoff not found".to_string())?;

    serde_json::to_string_pretty(handoff).map_err(|e| e.to_string())
}

/// Import a handoff from a machine-readable JSON string, assigning a new ID.
#[tauri::command]
pub fn import_handoff(
    rig_id: String,
    json_data: String,
    state: State<AppState>,
) -> Result<Handoff, String> {
    // ensure rig exists
    {
        let rigs = state.rigs.lock().unwrap();
        if !rigs.iter().any(|r| r.id == rig_id) {
            return Err("Rig not found".to_string());
        }
    }

    let mut handoff: Handoff =
        serde_json::from_str(&json_data).map_err(|e| format!("Invalid handoff JSON: {}", e))?;

    // Assign a fresh ID and override rig_id so it belongs to the target rig
    handoff.handoff_id = uuid::Uuid::new_v4().to_string();
    handoff.rig_id = rig_id.clone();
    // Reset status to pending so the recipient can act on it
    handoff.status = HandoffStatus::Pending;
    handoff.accepted_at = None;
    handoff.rejected_at = None;
    handoff.rejected_reason = None;
    handoff.created_at = chrono::Utc::now().to_rfc3339();

    let mut handoffs = state.handoffs.lock().unwrap();
    handoffs.push(handoff.clone());
    state.save_handoffs(&handoffs);

    let payload = serde_json::json!({
        "handoff_id": handoff.handoff_id,
        "imported": true,
        "from_actor_id": handoff.from_actor_id,
        "to_actor_id": handoff.to_actor_id,
    })
    .to_string();
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        Some(handoff.from_actor_id.clone()),
        Some(handoff.work_item_id.clone()),
        AuditEventType::HandoffCreated,
        payload,
    ));

    Ok(handoff)
}
