use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub rig_id: String,
    pub title: String,
    pub description: String,
    pub tags: Vec<String>,
    pub priority: TaskPriority,
    pub status: TaskStatus,
    pub assigned_worker_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskUpdateRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub priority: Option<TaskPriority>,
    pub status: Option<TaskStatus>,
    pub assigned_worker_id: Option<Option<String>>,
}

impl Task {
    pub fn new(
        rig_id: String,
        title: String,
        description: String,
        tags: Vec<String>,
        priority: TaskPriority,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            rig_id,
            title,
            description,
            tags,
            priority,
            status: TaskStatus::Todo,
            assigned_worker_id: None,
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn apply_update(&mut self, update: TaskUpdateRequest) {
        if let Some(title) = update.title {
            self.title = title;
        }
        if let Some(description) = update.description {
            self.description = description;
        }
        if let Some(tags) = update.tags {
            self.tags = tags;
        }
        if let Some(priority) = update.priority {
            self.priority = priority;
        }
        if let Some(status) = update.status {
            self.status = status;
        }
        if let Some(assigned_worker_id) = update.assigned_worker_id {
            self.assigned_worker_id = assigned_worker_id;
        }
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }
}
