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

/// How completed convoy work gets merged back (mirrors `gt convoy --merge` flag).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MergeStrategy {
    /// Merge directly to the rig's default branch (git merge --no-ff).
    Direct,
    /// Open a pull/merge request and wait for review.
    Mr,
    /// Keep changes local; no upstream push.
    Local,
}

impl Default for MergeStrategy {
    fn default() -> Self {
        MergeStrategy::Direct
    }
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
    /// When `true` this convoy "owns" its work items — landing it merges + closes them.
    #[serde(default)]
    pub owned: bool,
    /// Actor that created/owns this convoy.
    #[serde(default)]
    pub owner_actor_id: Option<String>,
    /// Which merge strategy to use when landing this convoy.
    #[serde(default)]
    pub merge_strategy: MergeStrategy,
    /// Notes written when landing the convoy (summary of changes).
    #[serde(default)]
    pub land_notes: Option<String>,
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
            owned: false,
            owner_actor_id: None,
            merge_strategy: MergeStrategy::default(),
            land_notes: None,
        }
    }
}
