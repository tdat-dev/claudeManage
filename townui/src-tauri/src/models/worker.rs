use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WorkerStatusEnum {
    Running,
    Stopped,
    Failed,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WorkerType {
    Crew,
    Polecat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Worker {
    pub id: String,
    pub rig_id: String,
    pub crew_id: String,
    pub agent_type: String,
    pub actor_id: Option<String>,
    pub worker_type: WorkerType,
    pub status: WorkerStatusEnum,
    pub pid: Option<u32>,
    pub started_at: String,
    pub stopped_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub stream: String,
    pub line: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RunStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Run {
    pub id: String,
    pub task_id: String,
    pub worker_id: String,
    pub crew_id: String,
    pub rig_id: String,
    pub agent_type: String,
    pub template_name: String,
    pub rendered_prompt: String,
    pub status: RunStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub exit_code: Option<i32>,
    pub diff_stats: Option<String>,
}

impl Worker {
    pub fn new(rig_id: String, crew_id: String, agent_type: String, worker_type: WorkerType, actor_id: Option<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            rig_id,
            crew_id,
            agent_type,
            actor_id,
            worker_type,
            status: WorkerStatusEnum::Running,
            pid: None,
            started_at: chrono::Utc::now().to_rfc3339(),
            stopped_at: None,
        }
    }
}

impl Run {
    pub fn new(
        task_id: String,
        worker_id: String,
        crew_id: String,
        rig_id: String,
        agent_type: String,
        template_name: String,
        rendered_prompt: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            task_id,
            worker_id,
            crew_id,
            rig_id,
            agent_type,
            template_name,
            rendered_prompt,
            status: RunStatus::Running,
            started_at: chrono::Utc::now().to_rfc3339(),
            finished_at: None,
            exit_code: None,
            diff_stats: None,
        }
    }
}
