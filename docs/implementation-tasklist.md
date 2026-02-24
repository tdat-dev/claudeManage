# ClaudeManage / TownUI — Implementation Tasklist

> Dựa trên docs Gas Town (`gastown-for-claudemanage.md`, `gastown-comprehensive-for-claudemanage.md`)  
> So sánh với code hiện tại tại `townui/`  
> Cập nhật lần cuối: 2026-02-12

---

## Phase 1: Durable Work Core

### 1.1 Mở rộng Task → WorkItem model (Backend)

- [x] Thêm field `acceptance_criteria: Option<String>` vào `Task`
- [x] Thêm field `dependencies: Vec<String>` (list task_id) vào `Task`
- [x] Thêm field `owner_actor_id: Option<String>` vào `Task`
- [x] Thêm field `convoy_id: Option<String>` vào `Task`
- [x] Thêm field `hook_id: Option<String>` vào `Task`
- [x] Thêm field `completed_at: Option<String>` vào `Task`
- [x] Thêm field `outcome: Option<String>` vào `Task`
- [x] Cập nhật `TaskUpdateRequest` tương ứng
- [x] Cập nhật `Task::new()` và `apply_update()` tương ứng

### 1.2 Mở rộng Task status machine

- [x] Thêm `Blocked` vào `TaskStatus` enum
- [x] Thêm `Deferred` vào `TaskStatus` enum
- [x] Thêm `Escalated` vào `TaskStatus` enum
- [x] Thêm transition guard: `InProgress` → chỉ cho `Done/Blocked/Deferred/Escalated/Cancelled`
- [x] Thêm field `blocked_reason: Option<String>` vào `Task`

### 1.3 Frontend TaskBoard cập nhật

- [x] Cập nhật `TaskItem` type trong `lib/tauri.ts` match backend mới
- [x] Thêm cột/lane `Blocked`, `Deferred`, `Escalated` trong `TaskBoard.tsx`
- [x] Hiển thị `acceptance_criteria`, `dependencies`, `blocked_reason` trong task detail
- [x] Form tạo task thêm field `acceptance_criteria`

### 1.4 Audit Event Log (Backend)

- [x] Tạo model `AuditEvent` (`event_id`, `actor_id`, `work_item_id`, `event_type`, `payload_json`, `emitted_at`)
- [x] Tạo `models/audit.rs` + thêm vào `models/mod.rs`
- [x] Tạo `commands/audit.rs` với `list_events(rig_id)`, `get_events_for_task(task_id)`
- [x] Thêm vào `lib.rs` invoke handler
- [x] Ghi audit event khi: task created/updated/status changed/deleted
- [x] Ghi audit event khi: worker spawned/stopped/failed/completed
- [x] Lưu events append-only vào file `{data}/audit_events.jsonl`

### 1.5 Audit Event Log (Frontend)

- [x] Thêm type `AuditEvent` trong `lib/tauri.ts`
- [x] Thêm hook `useAuditLog.ts`
- [x] Thêm component `AuditTimeline.tsx` — hiển thị timeline events
- [x] Tích hợp vào `RigDetails` hoặc tab riêng

---

## Phase 2: Hook & Handoff System

### 2.1 Hook model (Backend)

- [x] Tạo model `Hook` (`hook_id`, `attached_actor_id`, `current_work_id`, `state_blob`, `last_heartbeat`, `created_at`)
- [x] Tạo `models/hook.rs` + thêm vào `models/mod.rs`
- [x] Tạo `commands/hooks.rs` — `create_hook`, `assign_to_hook`, `sling` (execute immediately), `done`, `list_hooks`
- [x] Thêm vào `lib.rs` invoke handler
- [x] Hook persistence trong `state.rs`
- [x] Ghi audit event khi hook created/assigned/slung/done

### 2.2 Hook (Frontend)

- [x] Thêm types `HookInfo` trong `lib/tauri.ts`
- [x] Thêm hook `useHooks.ts`
- [x] Thêm component `HookInbox.tsx` — queue view per-agent
- [x] Tích hợp nút "Sling" (assign + execute ngay) vào TaskBoard
- [x] Tích hợp nút "Done" vào worker terminal khi task hoàn thành

### 2.3 Handoff model (Backend)

- [x] Tạo model `Handoff` (`handoff_id`, `from_actor_id`, `to_actor_id`, `work_item_id`, `context_summary`, `blockers`, `next_steps`, `created_at`, `status`)
- [x] Tạo `models/handoff.rs` + thêm vào `models/mod.rs`
- [x] Tạo `commands/handoffs.rs` — `create_handoff`, `accept_handoff`, `list_handoffs`
- [x] Thêm vào `lib.rs` invoke handler
- [x] Handoff persistence trong `state.rs`

### 2.4 Handoff (Frontend)

- [x] Thêm types `HandoffInfo` trong `lib/tauri.ts`
- [x] Thêm hook `useHandoffs.ts`
- [x] Thêm component `HandoffCenter.tsx` — danh sách handoff pending/accepted
- [x] Tích hợp nút "Handoff" vào worker panel khi cần chuyển task

### 2.5 Resume API

- [x] Backend: `resume_hook(hook_id)` — tải state_blob + spawn worker tiếp tục
- [x] Frontend: nút "Resume" trên HookInbox cho hook đã bị interrupt
- [x] Ghi audit event khi resume

---

## Phase 3: Convoy & Cross-Rig Orchestration

### 3.1 Convoy model (Backend)

- [x] Tạo model `Convoy` (`convoy_id`, `title`, `description`, `status`, `rig_ids: Vec<String>`, `work_item_ids: Vec<String>`, `created_at`, `updated_at`, `completed_at`)
- [x] Tạo `models/convoy.rs` + thêm vào `models/mod.rs`
- [x] Tạo `commands/convoys.rs` — `create_convoy`, `add_item_to_convoy`, `get_convoy`, `list_convoys`, `update_convoy_status`
- [x] Thêm vào `lib.rs` invoke handler
- [x] Convoy persistence trong `state.rs`
- [x] Ghi audit event khi convoy created/updated/completed

### 3.2 Convoy (Frontend)

- [x] Thêm types `ConvoyInfo` trong `lib/tauri.ts`
- [x] Thêm hook `useConvoys.ts`
- [x] Thêm component `ConvoyBoard.tsx` — board view multi-task progress
- [x] Thêm nav entry "Convoys" vào `Layout.tsx`
- [x] Hiển thị convoy progress (% done, blocked items, cross-rig view)

### 3.3 Actor/Identity model

- [x] Tạo model `Actor` (`actor_id`, `name`, `role`, `agent_type`, `rig_id`, `created_at`)
- [x] Tạo `models/actor.rs` + thêm vào `models/mod.rs`
- [x] Liên kết Worker → Actor (actor_id ổn định, worker session tạm thời)
- [x] Hiển thị actor identity trong WorkerPanel/TerminalTabs

---

## Phase 4: Workflow Engine

### 4.1 Workflow Template (Formula)

- [x] Tạo model `WorkflowTemplate` (`template_id`, `name`, `description`, `steps: Vec<WorkflowStep>`, `variables`)
- [x] `WorkflowStep`: `step_id`, `title`, `command_template`, `dependencies: Vec<step_id>`, `acceptance_criteria`
- [x] CRUD API: `create_template`, `list_templates`, `get_template`
- [x] Persistence

### 4.2 Workflow Instance (Molecule)

- [x] Tạo model `WorkflowInstance` (`instance_id`, `template_id`, `convoy_id`, `variables_resolved`, `steps_status: Map<step_id, status>`, `created_at`)
- [x] API: `instantiate_workflow`, `advance_step`, `get_instance_status`
- [x] Dependency graph execution (chỉ chạy step khi dependencies done)
- [x] Retry/escalation policy cơ bản

### 4.3 Workflow (Frontend)

- [x] Component `WorkflowRunner.tsx` — DAG visualization + step status
- [x] Tích hợp instantiate từ template vào ConvoyBoard

---

## Phase 5: Health & Operations

### 5.1 Health Monitoring (Backend)

- [x] Stuck task detection: task `in_progress` quá N phút không update → auto-escalate
- [x] Worker heartbeat: detect worker crash và update status
- [x] Queue health metrics: pending/blocked/stale counts per rig

### 5.2 Health Dashboard (Frontend)

- [x] Component `HealthDashboard.tsx` — overview all rigs
- [x] Indicators: worker count, queue depth, stuck tasks, blocked items
- [x] Alert for stuck/crashed workers

### 5.3 Failure Center

- [x] Component `FailureCenter.tsx` — list blocked/escalated/failed tasks with reasons
- [x] Quick actions: reassign, resume, cancel, handoff

### 5.4 Gas Town Operation Aliases

- [x] Backend command aliases: `town_up`, `town_down`, `town_status`, `town_doctor`
- [x] Backend command alias: `town_fix` (reconcile + compact)
- [x] Backend command aliases: `town_install`, `town_shutdown`
- [x] Backend role controls: `get_roles_status`, `set_roles_status`
- [x] Backend orchestration commands: `mayor_plan_objective`, `deacon_patrol`, `witness_report`
- [x] HealthDashboard tích hợp controls cho Up/Down/Doctor
- [x] HealthDashboard tích hợp quick action `Fix`
- [x] HealthDashboard tích hợp controls Install/Shutdown + Mayor/Deacon/Witness
- [x] Doctor report: orphan in-progress tasks, failed workers, hook/task mismatch, rig/actor checks

---

## Bugs / Technical Debt

- [x] Codex CLI trên Windows: `0xC0000142` PTY init failure → chuyển non-PTY spawn
- [x] Codex CLI: `program not found` → thêm Windows CLI path resolver
- [x] Codex CLI: `os error 193` → ưu tiên `.cmd/.exe` extension
- [x] Worker fail log: thêm exit code vào log output khi process thất bại
- [ ] Codex CLI: chưa test end-to-end sau resolver fix (cần verify)
- [x] `worker-status` event emit `Debug` format ("Completed") vs frontend lowercase enum ("completed") — potential mismatch
- [x] Cleanup: gỡ PowerShell wrapper branch trong `spawn_worker_inner` (đã thay bằng non-PTY path)

---

## Gas Town Compatibility Checklist (từ docs §13)

- [x] Task tồn tại độc lập với session runtime (JSON persistence)
- [x] Handoff có format chuẩn + machine-readable
- [x] Có convoy/group để nhìn tiến độ mục tiêu lớn
- [x] Có khả năng resume task sau restart
- [x] Có audit trail đầy đủ cho mọi thay đổi trạng thái
- [x] Có cơ chế phát hiện stuck tasks tự động

---

## Phase 6: AI Ingress Bridge (MCP-lite)

### 6.1 Backend bridge

- [x] Thêm runtime state cho AI inbox bridge (`running`, `bind_addr`, counters, last_error)
- [x] Thêm command `start_ai_inbox`, `stop_ai_inbox`, `get_ai_inbox_status`
- [x] Thêm HTTP endpoint `POST /api/ai/tasks` (single task / batch task)
- [x] Thêm HTTP endpoint `POST /api/ai/brief` (biến text brief thành nhiều task)
- [x] Thêm optional token auth qua header `x-townui-token`
- [x] Thêm CORS mở để UI ngoài có thể kết nối localhost bridge
- [x] Tái sử dụng luồng create task hiện tại + emit `data-changed` để Kanban update realtime

### 6.2 Frontend integration

- [x] Thêm API wrappers trong `src/lib/tauri.ts` cho AI inbox commands
- [x] Thêm panel điều khiển AI Inbox Bridge ở `SettingsPage`
- [x] Hiển thị trạng thái bridge + metrics (`requests/accepted/rejected`)
- [x] Cung cấp `curl` mẫu để kết nối AI/automation bên ngoài

### 6.3 Follow-up (pending)

- [ ] Tạo UI “AI Quick Intake” ngay trong TaskBoard (nhập brief trực tiếp)
- [ ] Persist cấu hình AI bridge (bind/token) vào settings
- [ ] Tự động start bridge theo setting khi app launch
- [ ] Thêm rate-limit/IP allowlist cho bridge (hardening)
- [ ] Viết e2e test: POST payload -> task xuất hiện trên Kanban

---

## Phase 7: Formula/Molecule Terminology Alignment

### 7.1 Backend aliases

- [x] `cook_formula(template_id, variables)` -> `Protomolecule`
- [x] `pour_protomolecule(protomolecule, rig_id, convoy_id)` -> `WorkflowInstance`
- [x] `create_wisp_preview(template_id, rig_id, variables)` -> ephemeral `Wisp` preview (non-persistent)

### 7.2 Frontend SDK

- [x] Thêm types + invoke wrappers cho `Protomolecule` / `WispPreview` trong `src/lib/tauri.ts`

---

## Phase 8: Duplicate-Execution Guard (Lease)

- [x] Hook model thêm `lease_token`, `lease_expires_at` (backward-compatible serde default)
- [x] `sling` / `assign_to_hook` phát lease mới khi dispatch
- [x] `resume_hook` chặn resume khi lease còn active và phát lease mới khi resume hợp lệ
- [x] `done` clear lease khi đóng task/hook
- [x] queue snapshot expose lease metadata cho quan sát
- [x] supervisor reconcile clear lease khi requeue/clear orphan hook
