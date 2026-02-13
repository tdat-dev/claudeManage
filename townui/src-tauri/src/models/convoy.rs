use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConvoyStatus {
    Planning,
    Active,
    Blocked,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Convoy {
    pub convoy_id: String,
    pub title: String,
    pub description: String,
    pub status: ConvoyStatus,
    pub rig_ids: Vec<String>,
    pub work_item_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

impl Convoy {
    pub fn new(title: String, description: String, rig_ids: Vec<String>) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            convoy_id: uuid::Uuid::new_v4().to_string(),
            title,
            description,
            status: ConvoyStatus::Planning,
            rig_ids,
            work_item_ids: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
            completed_at: None,
        }
    }
}
