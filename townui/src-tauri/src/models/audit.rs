use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    TaskCreated,
    TaskUpdated,
    TaskStatusChanged,
    TaskDeleted,
    WorkerSpawned,
    WorkerStopped,
    WorkerFailed,
    WorkerCompleted,
    RunStarted,
    RunCompleted,
    RunFailed,
    HookCreated,
    HookAssigned,
    HookSlung,
    HookDone,
    HookResumed,
    HandoffCreated,
    HandoffAccepted,
    ConvoyCreated,
    ConvoyUpdated,
    ConvoyCompleted,
    WorkflowInstantiated,
    WorkflowCompleted,
    WorkflowFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub event_id: String,
    pub rig_id: String,
    pub actor_id: Option<String>,
    pub work_item_id: Option<String>,
    pub event_type: AuditEventType,
    pub payload_json: String,
    pub emitted_at: String,
}

impl AuditEvent {
    pub fn new(
        rig_id: String,
        actor_id: Option<String>,
        work_item_id: Option<String>,
        event_type: AuditEventType,
        payload_json: String,
    ) -> Self {
        Self {
            event_id: uuid::Uuid::new_v4().to_string(),
            rig_id,
            actor_id,
            work_item_id,
            event_type,
            payload_json,
            emitted_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}
