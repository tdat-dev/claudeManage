use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum HandoffStatus {
    Pending,
    Accepted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Handoff {
    pub handoff_id: String,
    pub rig_id: String,
    pub from_actor_id: String,
    pub to_actor_id: String,
    pub work_item_id: String,
    pub context_summary: String,
    pub blockers: Vec<String>,
    pub next_steps: Vec<String>,
    pub created_at: String,
    pub status: HandoffStatus,
    pub accepted_at: Option<String>,
}

impl Handoff {
    pub fn new(
        rig_id: String,
        from_actor_id: String,
        to_actor_id: String,
        work_item_id: String,
        context_summary: String,
        blockers: Vec<String>,
        next_steps: Vec<String>,
    ) -> Self {
        Self {
            handoff_id: uuid::Uuid::new_v4().to_string(),
            rig_id,
            from_actor_id,
            to_actor_id,
            work_item_id,
            context_summary,
            blockers,
            next_steps,
            created_at: chrono::Utc::now().to_rfc3339(),
            status: HandoffStatus::Pending,
            accepted_at: None,
        }
    }
}
