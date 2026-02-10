use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rig {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub last_opened: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub last_opened: String,
    pub git_branch: Option<String>,
    pub git_status: Option<String>,
    pub is_git_repo: bool,
}

impl Rig {
    pub fn new(name: String, path: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path,
            created_at: now.clone(),
            last_opened: now,
        }
    }

    pub fn to_info(&self, git_branch: Option<String>, git_status: Option<String>, is_git_repo: bool) -> RigInfo {
        RigInfo {
            id: self.id.clone(),
            name: self.name.clone(),
            path: self.path.clone(),
            created_at: self.created_at.clone(),
            last_opened: self.last_opened.clone(),
            git_branch,
            git_status,
            is_git_repo,
        }
    }
}
