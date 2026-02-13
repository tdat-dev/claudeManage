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
    Blocked,
    Deferred,
    Escalated,
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
    // Gas Town extensions
    pub acceptance_criteria: Option<String>,
    pub dependencies: Vec<String>,
    pub owner_actor_id: Option<String>,
    pub convoy_id: Option<String>,
    pub hook_id: Option<String>,
    pub blocked_reason: Option<String>,
    pub outcome: Option<String>,
    pub completed_at: Option<String>,
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
    pub acceptance_criteria: Option<Option<String>>,
    pub dependencies: Option<Vec<String>>,
    pub owner_actor_id: Option<Option<String>>,
    pub convoy_id: Option<Option<String>>,
    pub hook_id: Option<Option<String>>,
    pub blocked_reason: Option<Option<String>>,
    pub outcome: Option<Option<String>>,
}

impl Task {
    pub fn new(
        rig_id: String,
        title: String,
        description: String,
        tags: Vec<String>,
        priority: TaskPriority,
        acceptance_criteria: Option<String>,
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
            acceptance_criteria,
            dependencies: Vec::new(),
            owner_actor_id: None,
            convoy_id: None,
            hook_id: None,
            blocked_reason: None,
            outcome: None,
            completed_at: None,
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
            // Auto-set completed_at when transitioning to Done
            if status == TaskStatus::Done && self.status != TaskStatus::Done {
                self.completed_at = Some(chrono::Utc::now().to_rfc3339());
            }
            // Clear completed_at if moving away from Done
            if status != TaskStatus::Done {
                self.completed_at = None;
            }
            self.status = status;
        }
        if let Some(assigned_worker_id) = update.assigned_worker_id {
            self.assigned_worker_id = assigned_worker_id;
        }
        if let Some(acceptance_criteria) = update.acceptance_criteria {
            self.acceptance_criteria = acceptance_criteria;
        }
        if let Some(dependencies) = update.dependencies {
            self.dependencies = dependencies;
        }
        if let Some(owner_actor_id) = update.owner_actor_id {
            self.owner_actor_id = owner_actor_id;
        }
        if let Some(convoy_id) = update.convoy_id {
            self.convoy_id = convoy_id;
        }
        if let Some(hook_id) = update.hook_id {
            self.hook_id = hook_id;
        }
        if let Some(blocked_reason) = update.blocked_reason {
            self.blocked_reason = blocked_reason;
        }
        if let Some(outcome) = update.outcome {
            self.outcome = outcome;
        }
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }
}
