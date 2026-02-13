# TownUI - Implementation Progress

> Last updated: 2026-02-12
> Source: docs/implementation-tasklist.md

## Phase 1: Durable Work Core — ~95% done

### 1.1 Task → WorkItem model (Backend) ✅
- [x] acceptance_criteria, dependencies, owner_actor_id, convoy_id, hook_id, completed_at, outcome fields
- [x] TaskUpdateRequest and Task::new()/apply_update() updated

### 1.2 Task status machine ✅ (1 item remaining)
- [x] Blocked, Deferred, Escalated added to TaskStatus enum
- [x] blocked_reason field added
- [ ] **Transition guard**: InProgress → chỉ cho Done/Blocked/Deferred/Escalated/Cancelled

### 1.3 Frontend TaskBoard ✅
- [x] TaskItem type updated, Blocked/Deferred/Escalated lanes, acceptance_criteria in form

### 1.4 Audit Event Log (Backend) ✅ (1 item remaining)
- [x] AuditEvent model, commands, persistence (JSONL), integration with task operations
- [ ] **Audit event for worker spawned/stopped/failed/completed** not yet emitting

### 1.5 Audit Event Log (Frontend) ✅
- [x] AuditEvent type, useAuditLog hook, AuditTimeline component

## Phase 2: Hook & Handoff System — ~95% done

### 2.1 Hook model (Backend) ✅
### 2.2 Hook (Frontend) ✅
### 2.3 Handoff model (Backend) ✅
### 2.4 Handoff (Frontend) ✅
### 2.5 Resume API — Partial
- [ ] **Backend: resume_hook(hook_id)** — tải state_blob + spawn worker tiếp tục
- [x] Frontend: Resume button on HookInbox

## Phase 3: Convoy & Cross-Rig — NOT STARTED
- [ ] Convoy model (convoy_id, title, description, status, rig_ids, work_item_ids)
- [ ] Convoy CRUD API + persistence
- [ ] ConvoyBoard.tsx component
- [ ] Actor/Identity model (actor_id, name, role, agent_type, rig_id)

## Phase 4: Workflow Engine — NOT STARTED
- [ ] WorkflowTemplate (Formula) model
- [ ] WorkflowInstance (Molecule) model
- [ ] WorkflowRunner.tsx component

## Phase 5: Health & Operations — NOT STARTED
- [ ] Stuck task detection, worker heartbeat, queue health metrics
- [ ] HealthDashboard.tsx
- [ ] FailureCenter.tsx

## Remaining Bugs / Tech Debt
- [ ] Codex CLI: chưa test end-to-end sau resolver fix
- [ ] worker-status event: Debug format ("Completed") vs frontend lowercase ("completed") mismatch
- [ ] Cleanup: gỡ PowerShell wrapper branch trong spawn_worker_inner

## Gas Town Compatibility Checklist
- [x] Task tồn tại độc lập với session runtime (JSON persistence)
- [ ] Handoff có format chuẩn + machine-readable
- [ ] Có convoy/group để nhìn tiến độ mục tiêu lớn
- [ ] Có khả năng resume task sau restart
- [x] Có audit trail đầy đủ cho mọi thay đổi trạng thái
- [ ] Có cơ chế phát hiện stuck tasks tự động