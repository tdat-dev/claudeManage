use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Crew {
    pub id: String,
    pub rig_id: String,
    pub name: String,
    pub branch: String,
    pub path: String,
    pub created_at: String,
    pub status: CrewStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CrewStatus {
    Active,
    Removed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrewInfo {
    pub id: String,
    pub rig_id: String,
    pub name: String,
    pub branch: String,
    pub path: String,
    pub created_at: String,
    pub status: CrewStatus,
    pub git_branch: Option<String>,
    pub git_status: Option<String>,
    pub changed_files: u32,
}

impl Crew {
    pub fn new(rig_id: String, name: String, branch: String, path: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            rig_id,
            name,
            branch,
            path,
            created_at: chrono::Utc::now().to_rfc3339(),
            status: CrewStatus::Active,
        }
    }

    pub fn to_info(
        &self,
        git_branch: Option<String>,
        git_status: Option<String>,
        changed_files: u32,
    ) -> CrewInfo {
        CrewInfo {
            id: self.id.clone(),
            rig_id: self.rig_id.clone(),
            name: self.name.clone(),
            branch: self.branch.clone(),
            path: self.path.clone(),
            created_at: self.created_at.clone(),
            status: self.status.clone(),
            git_branch,
            git_status,
            changed_files,
        }
    }
}
