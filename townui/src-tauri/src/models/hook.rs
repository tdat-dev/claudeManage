use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum HookStatus {
    Idle,
    Assigned,
    Running,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hook {
    pub hook_id: String,
    pub rig_id: String,
    pub attached_actor_id: String,
    pub current_work_id: Option<String>,
    pub state_blob: Option<String>,
    #[serde(default)]
    pub lease_token: Option<String>,
    #[serde(default)]
    pub lease_expires_at: Option<String>,
    pub status: HookStatus,
    pub worker_id: Option<String>,
    pub last_heartbeat: String,
    pub created_at: String,
}

impl Hook {
    pub fn new(rig_id: String, attached_actor_id: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            hook_id: uuid::Uuid::new_v4().to_string(),
            rig_id,
            attached_actor_id,
            current_work_id: None,
            state_blob: None,
            lease_token: None,
            lease_expires_at: None,
            status: HookStatus::Idle,
            worker_id: None,
            last_heartbeat: now.clone(),
            created_at: now,
        }
    }
}
