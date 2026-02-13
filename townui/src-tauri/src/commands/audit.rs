use tauri::State;

use crate::models::audit::AuditEvent;
use crate::state::AppState;

#[tauri::command]
pub fn list_audit_events(rig_id: String, limit: Option<usize>, state: State<AppState>) -> Vec<AuditEvent> {
    state.load_audit_events(Some(&rig_id), limit.unwrap_or(200))
}

#[tauri::command]
pub fn get_task_audit_events(task_id: String, state: State<AppState>) -> Vec<AuditEvent> {
    state.load_audit_events_for_task(&task_id)
}
