use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actor {
    pub actor_id: String,
    pub name: String,
    pub role: String,
    pub agent_type: String,
    pub rig_id: String,
    pub created_at: String,
}

impl Actor {
    pub fn new(name: String, role: String, agent_type: String, rig_id: String) -> Self {
        Self {
            actor_id: uuid::Uuid::new_v4().to_string(),
            name,
            role,
            agent_type,
            rig_id,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}
