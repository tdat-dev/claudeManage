use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::models::audit::{AuditEvent, AuditEventType};
use crate::models::workflow::{
    StepState, StepStatus, WorkflowInstance, WorkflowStatus, WorkflowStep, WorkflowTemplate,
};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtomoleculeStep {
    pub step_id: String,
    pub title: String,
    pub description: String,
    pub agent_type: String,
    pub dependencies: Vec<String>,
    pub command_resolved: String,
    pub acceptance_criteria: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Protomolecule {
    pub protomolecule_id: String,
    pub template_id: String,
    pub template_name: String,
    pub variables_resolved: HashMap<String, String>,
    pub steps: Vec<ProtomoleculeStep>,
    pub cooked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WispPreview {
    pub wisp_id: String,
    pub template_id: String,
    pub template_name: String,
    pub rig_id: String,
    pub variables_resolved: HashMap<String, String>,
    pub ready_steps: Vec<String>,
    pub created_at: String,
}

// ── Workflow Template (Formula) CRUD ──

#[tauri::command]
pub fn list_workflow_templates(state: State<AppState>) -> Vec<WorkflowTemplate> {
    let templates = state.workflow_templates.lock().unwrap();
    templates.clone()
}

#[tauri::command]
pub fn get_workflow_template(template_id: String, state: State<AppState>) -> Result<WorkflowTemplate, String> {
    let templates = state.workflow_templates.lock().unwrap();
    templates
        .iter()
        .find(|t| t.template_id == template_id)
        .cloned()
        .ok_or_else(|| "Workflow template not found".to_string())
}

#[tauri::command]
pub fn create_workflow_template(
    name: String,
    description: String,
    steps: Vec<WorkflowStep>,
    variables: Vec<String>,
    state: State<AppState>,
) -> WorkflowTemplate {
    let template = WorkflowTemplate::new(name, description, steps, variables);
    let mut templates = state.workflow_templates.lock().unwrap();
    templates.push(template.clone());
    state.save_workflow_templates(&templates);
    template
}

#[tauri::command]
pub fn delete_workflow_template(template_id: String, state: State<AppState>) -> Result<(), String> {
    let mut templates = state.workflow_templates.lock().unwrap();
    let len_before = templates.len();
    templates.retain(|t| t.template_id != template_id);
    if templates.len() == len_before {
        return Err("Workflow template not found".to_string());
    }
    state.save_workflow_templates(&templates);
    Ok(())
}

// ── Workflow Instance (Molecule) ──

#[tauri::command]
pub fn list_workflow_instances(rig_id: String, state: State<AppState>) -> Vec<WorkflowInstance> {
    let instances = state.workflow_instances.lock().unwrap();
    instances.iter().filter(|i| i.rig_id == rig_id).cloned().collect()
}

#[tauri::command]
pub fn get_workflow_instance(instance_id: String, state: State<AppState>) -> Result<WorkflowInstance, String> {
    let instances = state.workflow_instances.lock().unwrap();
    instances
        .iter()
        .find(|i| i.instance_id == instance_id)
        .cloned()
        .ok_or_else(|| "Workflow instance not found".to_string())
}

#[tauri::command]
pub fn instantiate_workflow(
    template_id: String,
    rig_id: String,
    convoy_id: Option<String>,
    variables: HashMap<String, String>,
    state: State<AppState>,
) -> Result<WorkflowInstance, String> {
    let templates = state.workflow_templates.lock().unwrap();
    let template = templates
        .iter()
        .find(|t| t.template_id == template_id)
        .ok_or_else(|| "Template not found".to_string())?;

    let instance = WorkflowInstance::new(template, rig_id.clone(), convoy_id, variables);
    drop(templates);

    let mut instances = state.workflow_instances.lock().unwrap();
    instances.push(instance.clone());
    state.save_workflow_instances(&instances);

    // Audit
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        None,
        Some(instance.instance_id.clone()),
        AuditEventType::WorkflowInstantiated,
        serde_json::json!({
            "template_name": &instance.template_name,
            "instance_id": &instance.instance_id,
        }).to_string(),
    ));

    Ok(instance)
}

/// Gas Town alias: cook formula into protomolecule.
#[tauri::command]
pub fn cook_formula(
    template_id: String,
    variables: HashMap<String, String>,
    state: State<AppState>,
) -> Result<Protomolecule, String> {
    let templates = state.workflow_templates.lock().unwrap();
    let template = templates
        .iter()
        .find(|t| t.template_id == template_id)
        .ok_or_else(|| "Template not found".to_string())?;

    let mut steps = Vec::new();
    for step in &template.steps {
        let missing = crate::templates::validate_variables(&step.command_template, &variables);
        if !missing.is_empty() {
            return Err(format!(
                "Step '{}' missing variables: {}",
                step.step_id,
                missing.join(", ")
            ));
        }
        let command_resolved = crate::templates::render_template(&step.command_template, &variables);
        steps.push(ProtomoleculeStep {
            step_id: step.step_id.clone(),
            title: step.title.clone(),
            description: step.description.clone(),
            agent_type: step.agent_type.clone(),
            dependencies: step.dependencies.clone(),
            command_resolved,
            acceptance_criteria: step.acceptance_criteria.clone(),
        });
    }

    Ok(Protomolecule {
        protomolecule_id: uuid::Uuid::new_v4().to_string(),
        template_id: template.template_id.clone(),
        template_name: template.name.clone(),
        variables_resolved: variables,
        steps,
        cooked_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Gas Town alias: pour protomolecule into a persisted molecule instance.
#[tauri::command]
pub fn pour_protomolecule(
    protomolecule: Protomolecule,
    rig_id: String,
    convoy_id: Option<String>,
    state: State<AppState>,
) -> Result<WorkflowInstance, String> {
    let templates = state.workflow_templates.lock().unwrap();
    let template = templates
        .iter()
        .find(|t| t.template_id == protomolecule.template_id)
        .ok_or_else(|| "Template not found for protomolecule".to_string())?;
    let instance = WorkflowInstance::new(
        template,
        rig_id.clone(),
        convoy_id,
        protomolecule.variables_resolved.clone(),
    );
    drop(templates);

    let mut instances = state.workflow_instances.lock().unwrap();
    instances.push(instance.clone());
    state.save_workflow_instances(&instances);

    state.append_audit_event(&AuditEvent::new(
        rig_id,
        None,
        Some(instance.instance_id.clone()),
        AuditEventType::WorkflowInstantiated,
        serde_json::json!({
            "template_name": &instance.template_name,
            "instance_id": &instance.instance_id,
            "source": "protomolecule",
            "protomolecule_id": &protomolecule.protomolecule_id,
        }).to_string(),
    ));

    Ok(instance)
}

/// Gas Town alias: lightweight ephemeral workflow (not persisted).
#[tauri::command]
pub fn create_wisp_preview(
    template_id: String,
    rig_id: String,
    variables: HashMap<String, String>,
    state: State<AppState>,
) -> Result<WispPreview, String> {
    let templates = state.workflow_templates.lock().unwrap();
    let template = templates
        .iter()
        .find(|t| t.template_id == template_id)
        .ok_or_else(|| "Template not found".to_string())?;
    let instance = WorkflowInstance::new(template, rig_id.clone(), None, variables.clone());
    let ready_steps = instance.ready_steps(template);

    Ok(WispPreview {
        wisp_id: uuid::Uuid::new_v4().to_string(),
        template_id: template.template_id.clone(),
        template_name: template.name.clone(),
        rig_id,
        variables_resolved: variables,
        ready_steps,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn start_workflow(instance_id: String, state: State<AppState>) -> Result<WorkflowInstance, String> {
    let mut instances = state.workflow_instances.lock().unwrap();
    let instance = instances
        .iter_mut()
        .find(|i| i.instance_id == instance_id)
        .ok_or_else(|| "Workflow instance not found".to_string())?;

    if instance.status != WorkflowStatus::Created {
        return Err("Workflow already started".to_string());
    }

    instance.status = WorkflowStatus::Running;
    instance.updated_at = chrono::Utc::now().to_rfc3339();
    let result = instance.clone();
    state.save_workflow_instances(&instances);
    Ok(result)
}

/// Get the next steps that are ready to run (dependencies met)
#[tauri::command]
pub fn get_ready_steps(instance_id: String, state: State<AppState>) -> Result<Vec<String>, String> {
    let instances = state.workflow_instances.lock().unwrap();
    let instance = instances
        .iter()
        .find(|i| i.instance_id == instance_id)
        .ok_or_else(|| "Workflow instance not found".to_string())?;

    let templates = state.workflow_templates.lock().unwrap();
    let template = templates
        .iter()
        .find(|t| t.template_id == instance.template_id)
        .ok_or_else(|| "Template not found".to_string())?;

    Ok(instance.ready_steps(template))
}

/// Mark a step as running
#[tauri::command]
pub fn advance_step(
    instance_id: String,
    step_id: String,
    new_status: StepStatus,
    worker_id: Option<String>,
    outcome: Option<String>,
    state: State<AppState>,
) -> Result<WorkflowInstance, String> {
    let mut instances = state.workflow_instances.lock().unwrap();
    let instance = instances
        .iter_mut()
        .find(|i| i.instance_id == instance_id)
        .ok_or_else(|| "Workflow instance not found".to_string())?;

    let step_state = instance
        .steps_status
        .get_mut(&step_id)
        .ok_or_else(|| "Step not found in instance".to_string())?;

    let now = chrono::Utc::now().to_rfc3339();

    match new_status {
        StepStatus::Running => {
            step_state.status = StepStatus::Running;
            step_state.started_at = Some(now.clone());
            step_state.worker_id = worker_id;
        }
        StepStatus::Done => {
            step_state.status = StepStatus::Done;
            step_state.finished_at = Some(now.clone());
            step_state.outcome = outcome;
        }
        StepStatus::Failed => {
            step_state.status = StepStatus::Failed;
            step_state.finished_at = Some(now.clone());
            step_state.outcome = outcome;
        }
        StepStatus::Skipped => {
            step_state.status = StepStatus::Skipped;
            step_state.finished_at = Some(now.clone());
        }
        StepStatus::Pending => {
            // Reset
            *step_state = StepState::default();
        }
    }

    instance.updated_at = now;

    // Check completion
    let templates = state.workflow_templates.lock().unwrap();
    if let Some(template) = templates.iter().find(|t| t.template_id == instance.template_id) {
        if instance.is_complete() {
            instance.status = WorkflowStatus::Completed;
            instance.completed_at = Some(chrono::Utc::now().to_rfc3339());

            state.append_audit_event(&AuditEvent::new(
                instance.rig_id.clone(),
                None,
                Some(instance.instance_id.clone()),
                AuditEventType::WorkflowCompleted,
                serde_json::json!({
                    "template_name": &instance.template_name,
                }).to_string(),
            ));
        } else if instance.has_failure() {
            instance.status = WorkflowStatus::Failed;

            state.append_audit_event(&AuditEvent::new(
                instance.rig_id.clone(),
                None,
                Some(instance.instance_id.clone()),
                AuditEventType::WorkflowFailed,
                serde_json::json!({
                    "template_name": &instance.template_name,
                    "failed_step": &step_id,
                }).to_string(),
            ));
        }
        // Check if there are still ready steps even though we're not complete
        let _ready = instance.ready_steps(template);
    }
    drop(templates);

    let result = instance.clone();
    state.save_workflow_instances(&instances);
    Ok(result)
}

#[tauri::command]
pub fn cancel_workflow(instance_id: String, state: State<AppState>) -> Result<WorkflowInstance, String> {
    let mut instances = state.workflow_instances.lock().unwrap();
    let instance = instances
        .iter_mut()
        .find(|i| i.instance_id == instance_id)
        .ok_or_else(|| "Workflow instance not found".to_string())?;

    instance.status = WorkflowStatus::Cancelled;
    instance.updated_at = chrono::Utc::now().to_rfc3339();
    let result = instance.clone();
    state.save_workflow_instances(&instances);
    Ok(result)
}
