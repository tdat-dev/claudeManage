# Gas Town Comprehensive Notes for ClaudeManage

## 1. Purpose

This document summarizes Gas Town in a system-design format so we can reuse the ideas for ClaudeManage.
It is not a verbatim copy of the upstream README.

Primary source repo:
- https://github.com/steveyegge/gastown

Supporting docs:
- https://docs.gastownhall.ai/

## 2. Core Mental Model

Gas Town is an operating environment for many coding agents running concurrently.
It combines:
- durable work items (Beads)
- identity-aware work assignment (Hook, Sling, Handoff)
- multi-repo orchestration (Town and Rig)
- infrastructure agents that supervise worker agents

The system is optimized for reliability under interruption, attribution, and scale.

## 3. Architecture

### 3.1 Scope layers

- Town: global headquarters layer. Manages cross-rig orchestration.
- Rig: project/repo layer. Each rig has its own worker lifecycle and merge machinery.

### 3.2 Main roles

- Mayor: top-level orchestrator.
- Deacon: watchdog and patrol supervisor.
- Witness: per-rig health/coordination monitor.
- Refinery: per-rig merge queue and integration flow.
- Crew: long-lived worker identity.
- Polecat: short-lived worker for focused tasks.

### 3.3 Durability objects

- Bead: atomic work record.
- Hook: durable pinned work queue for an agent.
- Molecule: multi-step durable workflow instance.
- Wisp: lighter ephemeral workflow form.
- Formula: template definition for workflow logic.
- Protomolecule: pre-processed molecule template artifact.

## 4. Work Lifecycle

A typical flow:
1. Create or identify a bead.
2. Put it on an agent hook.
3. Use sling to start work immediately.
4. Worker executes and updates status.
5. If context switch needed, handoff to another worker.
6. Resume from handoff or parked work.
7. Mark done with outcome metadata.

Operational principle:
- If work exists on hook, execution should start immediately.

## 5. Convoy Model

Convoy is the durable container for a multi-task, often multi-rig objective.

Key properties:
- stable identity over time
- progress visibility across related tasks
- worker set is dynamic (swarm is ephemeral)

Use convoy when:
- feature spans many repos
- the same goal requires multiple specialists
- tracking continuity matters more than short-lived sessions

## 6. Molecule and Formula Pipeline

Recommended lifecycle:
1. Define a formula (template).
2. Cook formula into protomolecule.
3. Pour protomolecule into molecule instance (or wisp).
4. Execute steps through bead readiness.
5. Squash results into digest/status trail.

Design implication:
- separate workflow definition from runtime instance state.

## 7. Operational Modes

- Minimal mode: bring your own runtime, Gas Town tracks state.
- Full stack mode: daemon plus tmux-managed lifecycle for many workers.

For ClaudeManage this suggests two tiers:
- Embedded mode in existing developer setup.
- Managed mode with full supervisor stack.

## 8. CLI Capability Map (Conceptual)

Work management:
- convoy
- sling
- hook
- handoff
- resume
- done
- molecule/formula commands

Workspace management:
- rig add/init
- worktree operations
- install/bootstrap

Services management:
- up/start/down/shutdown
- daemon control

Diagnostics:
- status
- doctor/fix

## 9. Data Model Blueprint for ClaudeManage

Suggested entities:
- agent
- crew_profile
- rig
- town
- work_item (bead equivalent)
- hook_queue
- workflow_template (formula)
- workflow_instance (molecule/wisp)
- convoy
- handoff_record
- run_event
- health_signal

Minimum fields for durable work_item:
- id
- title
- description
- state
- priority
- rig_id
- assigned_agent_id
- hook_id
- convoy_id
- created_at
- updated_at
- completed_at
- outcome

Event stream fields (run_event):
- event_id
- actor_agent_id
- work_item_id
- workflow_instance_id
- event_type
- payload_json
- emitted_at

## 10. API Surface Proposal

Controller-oriented endpoints:
- POST /convoys
- GET /convoys/:id
- POST /work-items
- POST /hooks/:id/sling
- POST /handoffs
- POST /resumes
- POST /work-items/:id/done
- GET /agents/:id/health
- GET /rigs/:id/queue

Runtime actions:
- startSupervisor
- stopSupervisor
- spawnWorker
- reconcileQueue
- compactState

## 11. UI Mapping for townui

Views that match the model:
- Convoy Board: durable initiative tracking.
- Hook Inbox: per-agent executable queue.
- Worker Sessions: crew/polecat lifecycle and terminal context.
- Workflow Runner: formula to molecule execution state.
- Health Dashboard: mayor/deacon/witness/refinery heartbeat.
- Handoff Center: pending transfers and resumable context.

## 12. Suggested Implementation Phases

Phase 1: Durable Work Core
- implement work_item, hook_queue, basic sling and done
- ensure restart-safe storage and replay

Phase 2: Multi-Agent Identity
- add crew and polecat model
- add assignment, lease, and handoff semantics

Phase 3: Workflow Engine
- add formula and molecule runtime
- add readiness gates and execution logs

Phase 4: Convoy and Cross-Rig
- add convoy orchestration
- add cross-rig scheduling and visibility

## 13. Key Risks and Controls

Risk: orphaned work when workers crash.
Control: hook as durable queue plus reconciler.

Risk: duplicate execution.
Control: lease token and idempotent completion semantics.

Risk: cross-rig attribution drift.
Control: strict work identity and immutable event trail.

Risk: merge bottlenecks.
Control: dedicated refinery queue and bounded concurrency.

## 14. Practical Rules to Preserve

- Work on hook means execute now.
- Prefer explicit handoff over implicit context loss.
- Keep worker identity stable for accountability.
- Separate long-lived workers from short-lived workers.
- Model every state transition as an event.

## 15. References

- https://github.com/steveyegge/gastown
- https://docs.gastownhall.ai/
- https://docs.gastownhall.ai/glossary/
- https://docs.gastownhall.ai/concepts/convoy/
- https://docs.gastownhall.ai/concepts/molecules/
- https://docs.gastownhall.ai/usage/work-management/
