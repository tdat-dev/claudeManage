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
  lease_token: string | null;
  lease_expires_at: string | null;
  status: HookStatus;
  last_heartbeat: string;
  created_at: string;
}

export interface HookQueueItem {
  hook_id: string;
  actor_id: string;
  status: string;
  current_work_id: string | null;
  last_heartbeat: string;
  lease_token: string | null;
  lease_expires_at: string | null;
}

export interface RigQueueSnapshot {
  rig_id: string;
  total_hooks: number;
  hooks_idle: number;
  hooks_assigned: number;
  hooks_running: number;
  pending_work_items: number;
  items: HookQueueItem[];
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

export async function deleteHook(hookId: string): Promise<void> {
  return invoke<void>("delete_hook", { hookId });
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

export async function getRigQueue(rigId: string): Promise<RigQueueSnapshot> {
  return invoke<RigQueueSnapshot>("get_rig_queue", { rigId });
}

// ── Handoff types ──

export type HandoffStatus = "pending" | "accepted" | "rejected";

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
  rejected_at: string | null;
  rejected_reason: string | null;
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

export async function rejectHandoff(
  handoffId: string,
  reason?: string,
): Promise<HandoffInfo> {
  return invoke<HandoffInfo>("reject_handoff", {
    handoffId,
    reason: reason ?? null,
  });
}

export async function exportHandoff(handoffId: string): Promise<string> {
  return invoke<string>("export_handoff", { handoffId });
}

export async function importHandoff(
  rigId: string,
  jsonData: string,
): Promise<HandoffInfo> {
  return invoke<HandoffInfo>("import_handoff", { rigId, jsonData });
}

// ── Convoy types ──

export type ConvoyStatus =
  | "planning"
  | "active"
  | "blocked"
  | "completed"
  | "cancelled";

export type MergeStrategy = "direct" | "mr" | "local";

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
  // Gas Town ownership & merge strategy
  owned: boolean;
  owner_actor_id: string | null;
  merge_strategy: MergeStrategy;
  land_notes: string | null;
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

export interface ActorHealth {
  actor_id: string;
  rig_id: string;
  tasks_total: number;
  tasks_in_progress: number;
  tasks_blocked: number;
  hook_status: string | null;
  last_heartbeat: string | null;
  has_running_worker: boolean;
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

export async function getActorHealth(actorId: string): Promise<ActorHealth> {
  return invoke<ActorHealth>("get_actor_health", { actorId });
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
  // Gas Town display fields
  startup_primed: boolean;
  task_label: string | null;
  crew_name: string | null;
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
  // A/B testing fields
  model_tag: string | null;
  quality_signal: number | null;
  revision_count: number;
}

export interface ModelStats {
  model_tag: string;
  agent_type: string;
  runs_total: number;
  runs_completed: number;
  runs_failed: number;
  avg_duration_secs: number | null;
  avg_quality_signal: number | null;
  avg_revision_count: number;
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
  // Startup priming
  startup_priming_enabled: boolean;
  priming_template: string | null;
  priming_delay_ms: number;
  // Propulsion & Witness
  propulsion_enabled: boolean;
  propulsion_interval_seconds: number;
  witness_auto_spawn: boolean;
  max_polecats_per_rig: number;
  polecat_nudge_after_seconds: number;
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

// ── AI Inbox Bridge ──

export interface AiInboxStatus {
  running: boolean;
  bind_addr: string | null;
  started_at: string | null;
  requests_total: number;
  accepted_total: number;
  rejected_total: number;
  last_error: string | null;
}

export async function getAiInboxStatus(): Promise<AiInboxStatus> {
  return invoke<AiInboxStatus>("get_ai_inbox_status");
}

export async function startAiInbox(
  bindAddr?: string,
  token?: string,
): Promise<AiInboxStatus> {
  return invoke<AiInboxStatus>("start_ai_inbox", {
    bindAddr: bindAddr ?? null,
    token: token ?? null,
  });
}

export async function stopAiInbox(): Promise<AiInboxStatus> {
  return invoke<AiInboxStatus>("stop_ai_inbox");
}

export async function ingestAiBrief(
  rigId: string,
  brief: string,
  source?: string,
  defaultPriority?: TaskPriority,
): Promise<TaskItem[]> {
  return invoke<TaskItem[]>("ingest_ai_brief", {
    rigId,
    brief,
    source: source ?? null,
    defaultPriority: defaultPriority ?? null,
  });
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
  | "handoff_rejected"
  | "convoy_created"
  | "convoy_updated"
  | "convoy_completed"
  | "workflow_instantiated"
  | "workflow_completed"
  | "workflow_failed"
  | "supervisor_started"
  | "supervisor_stopped"
  | "queue_reconciled"
  | "state_compacted"
  | "refinery_synced"
  | "refinery_sync_failed";

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

export interface SupervisorStatus {
  running: boolean;
  started_at: string | null;
  last_reconcile_at: string | null;
  last_compact_at: string | null;
  loop_interval_seconds: number;
  auto_refinery_sync: boolean;
  rigs_total: number;
  hooks_open: number;
  workers_running: number;
}

export interface ReconcileItem {
  rig_id: string;
  hook_id: string;
  task_id: string | null;
  action: string;
  reason: string;
}

export interface ReconcileReport {
  reconciled_at: string;
  checked_hooks: number;
  items_changed: number;
  items: ReconcileItem[];
}

export interface CompactReport {
  compacted_at: string;
  removed_workers: number;
  removed_runs: number;
  removed_crews: number;
}

export interface TownRuntimeStatus {
  rigs_total: number;
  tasks_total: number;
  hooks_open: number;
  workers_running: number;
  workers_failed: number;
  supervisor_running: boolean;
  supervisor_started_at: string | null;
  ai_inbox_running: boolean;
  ai_inbox_bind_addr: string | null;
  mayor_enabled: boolean;
  deacon_enabled: boolean;
  witness_enabled: boolean;
}

export interface DoctorIssue {
  code: string;
  severity: string;
  message: string;
  hint: string;
}

export interface DoctorReport {
  checked_at: string;
  rig_scope: string | null;
  healthy: boolean;
  issues: DoctorIssue[];
}

export interface FixReport {
  fixed_at: string;
  rig_scope: string | null;
  supervisor_started: boolean;
  reconciled_items_changed: number;
  compact_removed_workers: number;
  compact_removed_runs: number;
  compact_removed_crews: number;
}

export interface InstallReport {
  installed_at: string;
  town_dir: string;
  checks: string[];
  workflow_templates_existing: number;
  prompt_templates_builtin: number;
}

export interface RolesStatus {
  mayor_enabled: boolean;
  deacon_enabled: boolean;
  witness_enabled: boolean;
  updated_at: string | null;
}

export interface MayorPlanReport {
  planned_at: string;
  rig_id: string;
  objective: string;
  convoy_id: string | null;
  created_task_ids: string[];
}

export interface DeaconPatrolReport {
  patrolled_at: string;
  rig_scope: string | null;
  reconciled_items_changed: number;
  escalated_tasks: number;
}

export interface WitnessAlert {
  severity: string;
  code: string;
  message: string;
}

export interface WitnessReport {
  observed_at: string;
  rig_id: string;
  total_tasks: number;
  stuck_tasks: number;
  blocked_tasks: number;
  escalated_tasks: number;
  workers_running: number;
  workers_failed: number;
  hooks_idle: number;
  hooks_assigned: number;
  hooks_running: number;
  alerts: WitnessAlert[];
}

export interface RefineryQueueItem {
  crew_id: string;
  crew_name: string;
  branch: string;
  has_uncommitted_changes: boolean;
  ahead_by_commits: number;
  status: string;
}

export interface RefinerySkipItem {
  crew_id: string;
  crew_name: string;
  branch: string;
  reason: string;
}

export interface RefineryConflictItem {
  crew_id: string;
  crew_name: string;
  branch: string;
  error: string;
}

export interface RefinerySyncReport {
  rig_id: string;
  base_branch: string;
  synced_at: string;
  merged_branches: string[];
  skipped: RefinerySkipItem[];
  conflicts: RefineryConflictItem[];
  warnings: string[];
  pushed: boolean;
  restored_branch: string | null;
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

export async function getSupervisorStatus(): Promise<SupervisorStatus> {
  return invoke<SupervisorStatus>("get_supervisor_status");
}

export async function startSupervisor(
  loopIntervalSeconds?: number,
  autoRefinerySync?: boolean,
): Promise<SupervisorStatus> {
  return invoke<SupervisorStatus>("start_supervisor", {
    loopIntervalSeconds: loopIntervalSeconds ?? null,
    autoRefinerySync: autoRefinerySync ?? null,
  });
}

export async function stopSupervisor(): Promise<SupervisorStatus> {
  return invoke<SupervisorStatus>("stop_supervisor");
}

export async function reconcileQueue(rigId?: string): Promise<ReconcileReport> {
  return invoke<ReconcileReport>("reconcile_queue", { rigId: rigId ?? null });
}

export async function compactState(
  rigId?: string,
  finishedWorkerRetentionDays?: number,
): Promise<CompactReport> {
  return invoke<CompactReport>("compact_state", {
    rigId: rigId ?? null,
    finishedWorkerRetentionDays: finishedWorkerRetentionDays ?? null,
  });
}

export async function townUp(
  loopIntervalSeconds?: number,
  autoRefinerySync?: boolean,
): Promise<SupervisorStatus> {
  return invoke<SupervisorStatus>("town_up", {
    loopIntervalSeconds: loopIntervalSeconds ?? null,
    autoRefinerySync: autoRefinerySync ?? null,
  });
}

export async function townDown(): Promise<SupervisorStatus> {
  return invoke<SupervisorStatus>("town_down");
}

export async function townInstall(): Promise<InstallReport> {
  return invoke<InstallReport>("town_install");
}

export async function townShutdown(): Promise<TownRuntimeStatus> {
  return invoke<TownRuntimeStatus>("town_shutdown");
}

export async function townStatus(): Promise<TownRuntimeStatus> {
  return invoke<TownRuntimeStatus>("town_status");
}

export async function townDoctor(rigId?: string): Promise<DoctorReport> {
  return invoke<DoctorReport>("town_doctor", { rigId: rigId ?? null });
}

export async function townFix(
  rigId?: string,
  finishedWorkerRetentionDays?: number,
): Promise<FixReport> {
  return invoke<FixReport>("town_fix", {
    rigId: rigId ?? null,
    finishedWorkerRetentionDays: finishedWorkerRetentionDays ?? null,
  });
}

export async function getRolesStatus(): Promise<RolesStatus> {
  return invoke<RolesStatus>("get_roles_status");
}

export async function setRolesStatus(
  mayorEnabled?: boolean,
  deaconEnabled?: boolean,
  witnessEnabled?: boolean,
): Promise<RolesStatus> {
  return invoke<RolesStatus>("set_roles_status", {
    mayorEnabled: mayorEnabled ?? null,
    deaconEnabled: deaconEnabled ?? null,
    witnessEnabled: witnessEnabled ?? null,
  });
}

export async function mayorPlanObjective(
  rigId: string,
  objective: string,
  brief?: string,
  createConvoy?: boolean,
  priority?: TaskPriority,
  tags?: string[],
): Promise<MayorPlanReport> {
  return invoke<MayorPlanReport>("mayor_plan_objective", {
    rigId,
    objective,
    brief: brief ?? null,
    createConvoy: createConvoy ?? null,
    priority: priority ?? null,
    tags: tags ?? null,
  });
}

export async function deaconPatrol(
  rigId?: string,
  stuckThresholdMinutes?: number,
): Promise<DeaconPatrolReport> {
  return invoke<DeaconPatrolReport>("deacon_patrol", {
    rigId: rigId ?? null,
    stuckThresholdMinutes: stuckThresholdMinutes ?? null,
  });
}

export async function witnessReport(rigId: string): Promise<WitnessReport> {
  return invoke<WitnessReport>("witness_report", { rigId });
}

export async function getRefineryQueue(
  rigId: string,
): Promise<RefineryQueueItem[]> {
  return invoke<RefineryQueueItem[]>("get_refinery_queue", { rigId });
}

export async function syncRigRefinery(
  rigId: string,
  baseBranch?: string,
  pushRemote?: boolean,
): Promise<RefinerySyncReport> {
  return invoke<RefinerySyncReport>("sync_rig_refinery", {
    rigId,
    baseBranch: baseBranch ?? null,
    pushRemote: pushRemote ?? null,
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

export interface ProtomoleculeStep {
  step_id: string;
  title: string;
  description: string;
  agent_type: string;
  dependencies: string[];
  command_resolved: string;
  acceptance_criteria: string | null;
}

export interface Protomolecule {
  protomolecule_id: string;
  template_id: string;
  template_name: string;
  variables_resolved: Record<string, string>;
  steps: ProtomoleculeStep[];
  cooked_at: string;
}

export interface WispPreview {
  wisp_id: string;
  template_id: string;
  template_name: string;
  rig_id: string;
  variables_resolved: Record<string, string>;
  ready_steps: string[];
  created_at: string;
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

export async function cookFormula(
  templateId: string,
  variables: Record<string, string>,
): Promise<Protomolecule> {
  return invoke<Protomolecule>("cook_formula", {
    templateId,
    variables,
  });
}

export async function pourProtomolecule(
  protomolecule: Protomolecule,
  rigId: string,
  convoyId: string | null,
): Promise<WorkflowInstance> {
  return invoke<WorkflowInstance>("pour_protomolecule", {
    protomolecule,
    rigId,
    convoyId,
  });
}

export async function createWispPreview(
  templateId: string,
  rigId: string,
  variables: Record<string, string>,
): Promise<WispPreview> {
  return invoke<WispPreview>("create_wisp_preview", {
    templateId,
    rigId,
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
  formula_count: number;
  formula_names: string[];
  prompt_template_count: number;
}

export async function getSeedInfo(): Promise<SeedInfo> {
  return invoke<SeedInfo>("get_seed_info");
}

export async function seedWorkflowTemplates(): Promise<string[]> {
  return invoke<string[]>("seed_workflow_templates");
}

export async function seedGastownFormulas(): Promise<string[]> {
  return invoke<string[]>("seed_gastown_formulas");
}

export async function runRigCommand(
  rigId: string,
  command: string,
): Promise<TerminalCommandResult> {
  return invoke<TerminalCommandResult>("run_rig_command", { rigId, command });
}

// ── Cross-rig worktree ──

export async function createCrossRigWorktree(
  sourceRigId: string,
  crewId: string,
  branchName?: string,
): Promise<string> {
  return invoke<string>("create_cross_rig_worktree", {
    sourceRigId,
    crewId,
    branchName: branchName ?? null,
  });
}

// ── Convoy v2 & Land ──

export async function createConvoyV2(
  title: string,
  description: string,
  rigIds: string[],
  owned?: boolean,
  mergeStrategy?: MergeStrategy,
  ownerActorId?: string,
): Promise<ConvoyInfo> {
  return invoke<ConvoyInfo>("create_convoy_v2", {
    title,
    description,
    rigIds,
    owned: owned ?? false,
    mergeStrategy: mergeStrategy ?? "direct",
    ownerActorId: ownerActorId ?? null,
  });
}

export async function convoyLand(
  convoyId: string,
  landNotes?: string,
): Promise<ConvoyInfo> {
  return invoke<ConvoyInfo>("convoy_land", {
    convoyId,
    landNotes: landNotes ?? null,
  });
}

// ── Polecat spawn ──

export async function spawnPolecat(
  rigId: string,
  agentType: string,
  initialPrompt: string,
  actorId?: string,
): Promise<WorkerInfo> {
  return invoke<WorkerInfo>("spawn_polecat", {
    rigId,
    agentType,
    initialPrompt,
    actorId: actorId ?? null,
  });
}

// ── A/B testing ──

export async function setRunModelTag(runId: string, modelTag: string): Promise<RunInfo> {
  return invoke<RunInfo>("set_run_model_tag", { runId, modelTag });
}

export async function setRunQualitySignal(runId: string, qualitySignal: number): Promise<RunInfo> {
  return invoke<RunInfo>("set_run_quality_signal", { runId, qualitySignal });
}

export async function listRunStats(rigId?: string): Promise<ModelStats[]> {
  return invoke<ModelStats[]>("list_run_stats", { rigId: rigId ?? null });
}

// ── Dog Pool ──

export type DogRole = "boot" | "health_check" | "log_rotation" | "orphan_cleanup" | "hook_repair";
export type DogStatus = "pending" | "running" | "completed" | "failed";

export interface DogInfo {
  id: string;
  rig_id: string | null;
  role: DogRole;
  status: DogStatus;
  result: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface DogPoolStatus {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export async function listDogs(): Promise<DogInfo[]> {
  return invoke<DogInfo[]>("list_dogs");
}

export async function getDogPoolStatus(): Promise<DogPoolStatus> {
  return invoke<DogPoolStatus>("get_dog_pool_status");
}

export async function spawnDog(role: DogRole, rigId?: string): Promise<DogInfo> {
  return invoke<DogInfo>("spawn_dog", { role, rigId: rigId ?? null });
}

export async function pruneDogs(): Promise<number> {
  return invoke<number>("prune_dogs");
}
