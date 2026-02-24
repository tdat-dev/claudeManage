import { invoke } from "@tauri-apps/api/core";

// ── Rig types ──

export interface RigInfo {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_opened: string;
  git_branch: string | null;
  git_status: string | null;
  is_git_repo: boolean;
}

export interface TerminalCommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

export async function listRigs(): Promise<RigInfo[]> {
  return invoke<RigInfo[]>("list_rigs");
}

export async function createRig(path: string): Promise<RigInfo> {
  return invoke<RigInfo>("create_rig", { path });
}

export async function getRig(id: string): Promise<RigInfo> {
  return invoke<RigInfo>("get_rig", { id });
}

export async function deleteRig(id: string): Promise<void> {
  return invoke<void>("delete_rig", { id });
}

// ── Crew types ──

export interface CrewInfo {
  id: string;
  rig_id: string;
  name: string;
  branch: string;
  path: string;
  created_at: string;
  status: string;
  git_branch: string | null;
  git_status: string | null;
  changed_files: number;
}

export async function listCrews(rigId: string): Promise<CrewInfo[]> {
  return invoke<CrewInfo[]>("list_crews", { rigId });
}

export async function createCrew(
  rigId: string,
  name: string,
  baseBranch: string,
  pushToRemote: boolean = false,
): Promise<CrewInfo> {
  return invoke<CrewInfo>("create_crew", { rigId, name, baseBranch, pushToRemote });
}

export async function getCrew(id: string): Promise<CrewInfo> {
  return invoke<CrewInfo>("get_crew", { id });
}

export async function deleteCrew(id: string): Promise<void> {
  return invoke<void>("delete_crew", { id });
}

export async function listBranches(rigId: string): Promise<string[]> {
  return invoke<string[]>("list_branches", { rigId });
}

// ── Crew Presets ──

export interface CrewPreset {
  key: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export async function getCrewPresets(): Promise<CrewPreset[]> {
  return invoke<CrewPreset[]>("get_crew_presets");
}

// ── Task types ──

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "deferred"
  | "escalated"
  | "done"
  | "cancelled";

export interface TaskItem {
  id: string;
  rig_id: string;
  title: string;
  description: string;
  tags: string[];
  priority: TaskPriority;
  status: TaskStatus;
  assigned_worker_id: string | null;
  // Gas Town extensions
  acceptance_criteria: string | null;
  dependencies: string[];
  owner_actor_id: string | null;
  convoy_id: string | null;
  hook_id: string | null;
  blocked_reason: string | null;
  outcome: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  tags?: string[];
  priority?: TaskPriority;
  status?: TaskStatus;
  assigned_worker_id?: string | null;
  acceptance_criteria?: string | null;
  dependencies?: string[];
  owner_actor_id?: string | null;
  convoy_id?: string | null;
  hook_id?: string | null;
  blocked_reason?: string | null;
  outcome?: string | null;
}

export async function listTasks(rigId: string): Promise<TaskItem[]> {
  return invoke<TaskItem[]>("list_tasks", { rigId });
}

export async function createTask(
  rigId: string,
  title: string,
  description: string,
  tags: string[],
  priority: TaskPriority,
  acceptanceCriteria?: string,
): Promise<TaskItem> {
  return invoke<TaskItem>("create_task", {
    rigId,
    title,
    description,
    tags,
    priority,
    acceptanceCriteria: acceptanceCriteria || null,
  });
}

export async function updateTask(
  id: string,
  updates: TaskUpdate,
): Promise<TaskItem> {
  return invoke<TaskItem>("update_task", { id, updates });
}

export async function deleteTask(id: string): Promise<void> {
  return invoke<void>("delete_task", { id });
}

export interface IngestAiBriefResult {
  created: TaskItem[];
  ignored_lines: number;
}

export async function ingestAIBrief(
  rigId: string,
  brief: string,
): Promise<IngestAiBriefResult> {
  return invoke<IngestAiBriefResult>("ingest_ai_brief", { rigId, brief });
}

// ── Hook types ──

export type HookStatus = "idle" | "assigned" | "running" | "done";

export interface HookInfo {
  hook_id: string;
  rig_id: string;
  attached_actor_id: string;
  current_work_id: string | null;
  state_blob: string | null;
  status: HookStatus;
  last_heartbeat: string;
  created_at: string;
}

export async function listHooks(rigId: string): Promise<HookInfo[]> {
  return invoke<HookInfo[]>("list_hooks", { rigId });
}

export async function createHook(
  rigId: string,
  attachedActorId: string,
): Promise<HookInfo> {
  return invoke<HookInfo>("create_hook", { rigId, attachedActorId });
}

export async function assignToHook(
  hookId: string,
  workItemId: string,
  stateBlob?: string,
): Promise<HookInfo> {
  return invoke<HookInfo>("assign_to_hook", {
    hookId,
    workItemId,
    stateBlob: stateBlob ?? null,
  });
}

export async function sling(
  hookId: string,
  workItemId: string,
  stateBlob?: string,
): Promise<HookInfo> {
  return invoke<HookInfo>("sling", {
    hookId,
    workItemId,
    stateBlob: stateBlob ?? null,
  });
}

export async function doneHook(
  hookId: string,
  outcome?: string,
): Promise<HookInfo> {
  return invoke<HookInfo>("done", { hookId, outcome: outcome ?? null });
}

export async function resumeHook(hookId: string): Promise<HookInfo> {
  return invoke<HookInfo>("resume_hook", { hookId });
}

// ── Handoff types ──

export type HandoffStatus = "pending" | "accepted";

export interface HandoffInfo {
  handoff_id: string;
  rig_id: string;
  from_actor_id: string;
  to_actor_id: string;
  work_item_id: string;
  context_summary: string;
  blockers: string[];
  next_steps: string[];
  created_at: string;
  status: HandoffStatus;
  accepted_at: string | null;
}

export async function listHandoffs(rigId: string): Promise<HandoffInfo[]> {
  return invoke<HandoffInfo[]>("list_handoffs", { rigId });
}

export async function createHandoff(
  rigId: string,
  fromActorId: string,
  toActorId: string,
  workItemId: string,
  contextSummary: string,
  blockers: string[],
  nextSteps: string[],
): Promise<HandoffInfo> {
  return invoke<HandoffInfo>("create_handoff", {
    rigId,
    fromActorId,
    toActorId,
    workItemId,
    contextSummary,
    blockers,
    nextSteps,
  });
}

export async function acceptHandoff(
  handoffId: string,
  acceptedByActorId?: string,
): Promise<HandoffInfo> {
  return invoke<HandoffInfo>("accept_handoff", {
    handoffId,
    acceptedByActorId: acceptedByActorId ?? null,
  });
}

// ── Convoy types ──

export type ConvoyStatus =
  | "planning"
  | "active"
  | "blocked"
  | "completed"
  | "cancelled";

export interface ConvoyInfo {
  convoy_id: string;
  title: string;
  description: string;
  status: ConvoyStatus;
  rig_ids: string[];
  work_item_ids: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function listConvoys(): Promise<ConvoyInfo[]> {
  return invoke<ConvoyInfo[]>("list_convoys");
}

export async function getConvoy(convoyId: string): Promise<ConvoyInfo> {
  return invoke<ConvoyInfo>("get_convoy", { convoyId });
}

export async function createConvoy(
  title: string,
  description: string,
  rigIds: string[],
): Promise<ConvoyInfo> {
  return invoke<ConvoyInfo>("create_convoy", { title, description, rigIds });
}

export async function addItemToConvoy(
  convoyId: string,
  workItemId: string,
): Promise<ConvoyInfo> {
  return invoke<ConvoyInfo>("add_item_to_convoy", { convoyId, workItemId });
}

export async function updateConvoyStatus(
  convoyId: string,
  status: ConvoyStatus,
): Promise<ConvoyInfo> {
  return invoke<ConvoyInfo>("update_convoy_status", { convoyId, status });
}

// ── Actor types ──

export interface ActorInfo {
  actor_id: string;
  name: string;
  role: string;
  agent_type: string;
  rig_id: string;
  created_at: string;
}

export async function listActors(rigId: string): Promise<ActorInfo[]> {
  return invoke<ActorInfo[]>("list_actors", { rigId });
}

export async function createActor(
  name: string,
  role: string,
  agentType: string,
  rigId: string,
): Promise<ActorInfo> {
  return invoke<ActorInfo>("create_actor", { name, role, agentType, rigId });
}

export async function getActor(actorId: string): Promise<ActorInfo> {
  return invoke<ActorInfo>("get_actor", { actorId });
}

export async function deleteActor(actorId: string): Promise<void> {
  return invoke<void>("delete_actor", { actorId });
}

export async function executeTask(
  taskId: string,
  crewId: string,
  agentType: string,
  templateName: string,
): Promise<RunInfo> {
  return invoke<RunInfo>("execute_task", {
    taskId,
    crewId,
    agentType,
    templateName,
  });
}

// ── Worker types ──

export type WorkerStatus = "running" | "stopped" | "failed" | "completed";

export interface WorkerInfo {
  id: string;
  rig_id: string;
  crew_id: string;
  agent_type: string;
  actor_id: string | null;
  status: WorkerStatus;
  pid: number | null;
  started_at: string;
  stopped_at: string | null;
}

export interface LogEntry {
  timestamp: string;
  stream: "stdout" | "stderr";
  line: string;
}

export async function spawnWorker(
  crewId: string,
  agentType: string,
  initialPrompt: string,
): Promise<WorkerInfo> {
  return invoke<WorkerInfo>("spawn_worker", {
    crewId,
    agentType,
    initialPrompt,
  });
}

export async function stopWorker(id: string): Promise<void> {
  return invoke<void>("stop_worker", { id });
}

export async function deleteWorker(id: string): Promise<void> {
  return invoke<void>("delete_worker", { id });
}

export async function getWorkerStatus(id: string): Promise<WorkerInfo> {
  return invoke<WorkerInfo>("get_worker_status", { id });
}

export async function listWorkers(rigId: string): Promise<WorkerInfo[]> {
  return invoke<WorkerInfo[]>("list_workers", { rigId });
}

export async function getWorkerLogs(id: string): Promise<LogEntry[]> {
  return invoke<LogEntry[]>("get_worker_logs", { id });
}

export async function writeToWorker(id: string, input: string): Promise<void> {
  return invoke<void>("write_to_worker", { id, input });
}
export async function resizeWorkerPty(
  id: string,
  rows: number,
  cols: number,
): Promise<void> {
  return invoke("resize_worker_pty", { id, rows, cols });
}
// ── Run types ──

export type RunStatus = "running" | "completed" | "failed" | "cancelled";

export interface RunInfo {
  id: string;
  task_id: string;
  worker_id: string;
  crew_id: string;
  rig_id: string;
  agent_type: string;
  template_name: string;
  rendered_prompt: string;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  exit_code: number | null;
  diff_stats: string | null;
}

export async function listRuns(rigId: string): Promise<RunInfo[]> {
  return invoke<RunInfo[]>("list_runs", { rigId });
}

export async function getRun(id: string): Promise<RunInfo> {
  return invoke<RunInfo>("get_run", { id });
}

export async function getRunLogs(id: string): Promise<LogEntry[]> {
  return invoke<LogEntry[]>("get_run_logs", { id });
}

// ── Template types ──

export interface TemplateInfo {
  name: string;
  description: string;
  content: string;
  is_builtin: boolean;
}

export async function listTemplates(): Promise<TemplateInfo[]> {
  return invoke<TemplateInfo[]>("list_templates");
}

export async function renderTemplate(
  name: string,
  vars: Record<string, string>,
): Promise<string> {
  return invoke<string>("render_template", { name, vars });
}

// ── Settings types ──

export interface AppSettings {
  cli_paths: Record<string, string>;
  env_vars: Record<string, string>;
  default_template: string;
  default_cli: string;
  language: "en" | "vi";
  ai_inbox_bridge: {
    bind_addr: string;
    token: string;
    auto_start: boolean;
  };
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function updateSettings(settings: AppSettings): Promise<void> {
  return invoke<void>("update_settings", { settings });
}

export async function validateCliPath(path: string): Promise<string> {
  return invoke<string>("validate_cli_path", { path });
}

// ── Audit types ──

export type AuditEventType =
  | "task_created"
  | "task_updated"
  | "task_status_changed"
  | "task_deleted"
  | "worker_spawned"
  | "worker_stopped"
  | "worker_failed"
  | "worker_completed"
  | "run_started"
  | "run_completed"
  | "run_failed"
  | "hook_created"
  | "hook_assigned"
  | "hook_slung"
  | "hook_done"
  | "hook_resumed"
  | "handoff_created"
  | "handoff_accepted"
  | "convoy_created"
  | "convoy_updated"
  | "convoy_completed"
  | "workflow_instantiated"
  | "workflow_completed"
  | "workflow_failed";

export interface AuditEvent {
  event_id: string;
  rig_id: string;
  actor_id: string | null;
  work_item_id: string | null;
  event_type: AuditEventType;
  payload_json: string;
  emitted_at: string;
}

export async function listAuditEvents(
  rigId: string,
  limit?: number,
): Promise<AuditEvent[]> {
  return invoke<AuditEvent[]>("list_audit_events", { rigId, limit });
}

export async function getTaskAuditEvents(
  taskId: string,
): Promise<AuditEvent[]> {
  return invoke<AuditEvent[]>("get_task_audit_events", { taskId });
}

// ── Health Metrics ──

export interface StuckTaskInfo {
  task_id: string;
  title: string;
  minutes_stuck: number;
  assigned_worker_id: string | null;
}

export interface HealthMetrics {
  total_tasks: number;
  todo: number;
  in_progress: number;
  blocked: number;
  escalated: number;
  deferred: number;
  done: number;
  cancelled: number;
  stuck_tasks: StuckTaskInfo[];
  workers_running: number;
  workers_failed: number;
  workers_total: number;
  hooks_idle: number;
  hooks_assigned: number;
  hooks_running: number;
  handoffs_pending: number;
}

export async function getHealthMetrics(
  rigId: string,
  stuckThresholdMinutes?: number,
): Promise<HealthMetrics> {
  return invoke<HealthMetrics>("get_health_metrics", {
    rigId,
    stuckThresholdMinutes: stuckThresholdMinutes ?? null,
  });
}

export async function escalateStuckTasks(
  rigId: string,
  thresholdMinutes?: number,
): Promise<TaskItem[]> {
  return invoke<TaskItem[]>("escalate_stuck_tasks", {
    rigId,
    thresholdMinutes: thresholdMinutes ?? null,
  });
}

// ── Workflow types ──

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type WorkflowStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowStep {
  step_id: string;
  title: string;
  description: string;
  command_template: string;
  agent_type: string;
  dependencies: string[];
  acceptance_criteria: string | null;
}

export interface WorkflowTemplate {
  template_id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  variables: string[];
  created_at: string;
  updated_at: string;
}

export interface StepState {
  status: StepStatus;
  started_at: string | null;
  finished_at: string | null;
  worker_id: string | null;
  outcome: string | null;
}

export interface WorkflowInstance {
  instance_id: string;
  template_id: string;
  template_name: string;
  rig_id: string;
  convoy_id: string | null;
  variables_resolved: Record<string, string>;
  steps_status: Record<string, StepState>;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  return invoke<WorkflowTemplate[]>("list_workflow_templates");
}

export async function getWorkflowTemplate(
  templateId: string,
): Promise<WorkflowTemplate> {
  return invoke<WorkflowTemplate>("get_workflow_template", { templateId });
}

export async function createWorkflowTemplate(
  name: string,
  description: string,
  steps: WorkflowStep[],
  variables: string[],
): Promise<WorkflowTemplate> {
  return invoke<WorkflowTemplate>("create_workflow_template", {
    name,
    description,
    steps,
    variables,
  });
}

export async function deleteWorkflowTemplate(
  templateId: string,
): Promise<void> {
  return invoke<void>("delete_workflow_template", { templateId });
}

export async function listWorkflowInstances(
  rigId: string,
): Promise<WorkflowInstance[]> {
  return invoke<WorkflowInstance[]>("list_workflow_instances", { rigId });
}

export async function getWorkflowInstance(
  instanceId: string,
): Promise<WorkflowInstance> {
  return invoke<WorkflowInstance>("get_workflow_instance", { instanceId });
}

export async function instantiateWorkflow(
  templateId: string,
  rigId: string,
  convoyId: string | null,
  variables: Record<string, string>,
): Promise<WorkflowInstance> {
  return invoke<WorkflowInstance>("instantiate_workflow", {
    templateId,
    rigId,
    convoyId,
    variables,
  });
}

export async function startWorkflow(
  instanceId: string,
): Promise<WorkflowInstance> {
  return invoke<WorkflowInstance>("start_workflow", { instanceId });
}

export async function getReadySteps(instanceId: string): Promise<string[]> {
  return invoke<string[]>("get_ready_steps", { instanceId });
}

export async function advanceStep(
  instanceId: string,
  stepId: string,
  newStatus: StepStatus,
  workerId?: string,
  outcome?: string,
): Promise<WorkflowInstance> {
  return invoke<WorkflowInstance>("advance_step", {
    instanceId,
    stepId,
    newStatus,
    workerId: workerId ?? null,
    outcome: outcome ?? null,
  });
}

export async function cancelWorkflow(
  instanceId: string,
): Promise<WorkflowInstance> {
  return invoke<WorkflowInstance>("cancel_workflow", { instanceId });
}

// ── Seed Data ────────────────────────────────────────────────────────

export interface SeedInfo {
  workflow_template_count: number;
  workflow_template_names: string[];
  prompt_template_count: number;
}

export async function getSeedInfo(): Promise<SeedInfo> {
  return invoke<SeedInfo>("get_seed_info");
}

export async function seedWorkflowTemplates(): Promise<string[]> {
  return invoke<string[]>("seed_workflow_templates");
}

export async function runRigCommand(
  rigId: string,
  command: string,
): Promise<TerminalCommandResult> {
  return invoke<TerminalCommandResult>("run_rig_command", { rigId, command });
}
