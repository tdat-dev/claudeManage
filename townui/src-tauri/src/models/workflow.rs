use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Workflow Template (Formula) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub step_id: String,
    pub title: String,
    pub description: String,
    pub command_template: String,
    pub agent_type: String,
    pub dependencies: Vec<String>,
    pub acceptance_criteria: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTemplate {
    pub template_id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<WorkflowStep>,
    pub variables: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl WorkflowTemplate {
    pub fn new(
        name: String,
        description: String,
        steps: Vec<WorkflowStep>,
        variables: Vec<String>,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            template_id: uuid::Uuid::new_v4().to_string(),
            name,
            description,
            steps,
            variables,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

// ── Workflow Instance (Molecule) ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    Running,
    Done,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStatus {
    Created,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepState {
    pub status: StepStatus,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub worker_id: Option<String>,
    pub outcome: Option<String>,
}

impl Default for StepState {
    fn default() -> Self {
        Self {
            status: StepStatus::Pending,
            started_at: None,
            finished_at: None,
            worker_id: None,
            outcome: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowInstance {
    pub instance_id: String,
    pub template_id: String,
    pub template_name: String,
    pub rig_id: String,
    pub convoy_id: Option<String>,
    pub variables_resolved: HashMap<String, String>,
    pub steps_status: HashMap<String, StepState>,
    pub status: WorkflowStatus,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

impl WorkflowInstance {
    pub fn new(
        template: &WorkflowTemplate,
        rig_id: String,
        convoy_id: Option<String>,
        variables: HashMap<String, String>,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        let mut steps_status = HashMap::new();
        for step in &template.steps {
            steps_status.insert(step.step_id.clone(), StepState::default());
        }
        Self {
            instance_id: uuid::Uuid::new_v4().to_string(),
            template_id: template.template_id.clone(),
            template_name: template.name.clone(),
            rig_id,
            convoy_id,
            variables_resolved: variables,
            steps_status,
            status: WorkflowStatus::Created,
            created_at: now.clone(),
            updated_at: now,
            completed_at: None,
        }
    }

    /// Returns step_ids whose dependencies are all done and the step is still pending
    pub fn ready_steps(&self, template: &WorkflowTemplate) -> Vec<String> {
        template
            .steps
            .iter()
            .filter(|step| {
                if let Some(state) = self.steps_status.get(&step.step_id) {
                    if state.status != StepStatus::Pending {
                        return false;
                    }
                    // All dependencies must be Done
                    step.dependencies.iter().all(|dep_id| {
                        self.steps_status
                            .get(dep_id)
                            .map(|s| s.status == StepStatus::Done)
                            .unwrap_or(false)
                    })
                } else {
                    false
                }
            })
            .map(|s| s.step_id.clone())
            .collect()
    }

    /// Check if all steps are done or skipped
    pub fn is_complete(&self) -> bool {
        self.steps_status.values().all(|s| {
            s.status == StepStatus::Done || s.status == StepStatus::Skipped
        })
    }

    /// Check if any step failed
    pub fn has_failure(&self) -> bool {
        self.steps_status.values().any(|s| s.status == StepStatus::Failed)
    }
}
