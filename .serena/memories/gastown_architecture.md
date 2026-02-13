# Gas Town Architecture Reference

> Condensed from docs/gastown-for-claudemanage.md and gastown-comprehensive-for-claudemanage.md
> Source: https://github.com/steveyegge/gastown

## Core Mental Model
Gas Town = operating environment for many concurrent coding agents with:
- Durable work items (Beads)
- Identity-aware work assignment (Hook, Sling, Handoff)
- Multi-repo orchestration (Town and Rig)
- Infrastructure agents supervising worker agents

## Scope Layers
- **Town**: global headquarters, cross-rig orchestration
- **Rig**: project/repo layer, own worker lifecycle and merge machinery

## Roles
- **Mayor**: top-level orchestrator
- **Deacon**: watchdog/patrol supervisor
- **Witness**: per-rig health/coordination monitor
- **Refinery**: per-rig merge queue
- **Crew**: long-lived worker identity
- **Polecat**: short-lived focused task worker

## Durability Objects
- **Bead**: atomic work record → mapped to Task in TownUI
- **Hook**: durable pinned work queue → implemented in TownUI
- **Molecule**: multi-step durable workflow instance → Phase 4
- **Wisp**: lighter ephemeral workflow form
- **Formula**: template definition for workflow logic → Phase 4
- **Convoy**: multi-task objective container → Phase 3

## Work Lifecycle
1. Create/identify a bead
2. Put on agent hook
3. Sling to start immediately
4. Worker executes, updates status
5. Handoff if context switch needed
6. Resume from handoff/parked work
7. Mark done with outcome metadata

**Key rule**: Work on hook = execute now

## Practical Rules
- Prefer explicit handoff over implicit context loss
- Keep worker identity stable for accountability
- Separate long-lived workers from short-lived workers
- Model every state transition as an event
- Hook as durable queue + reconciler prevents orphaned work

## UI Views (from Gas Town design)
- Convoy Board: initiative tracking
- Hook Inbox: per-agent executable queue
- Worker Sessions: lifecycle and terminal context
- Workflow Runner: formula → molecule execution
- Health Dashboard: heartbeat monitoring
- Handoff Center: pending transfers and resumable context

## Key Risks & Controls
- Orphaned work → hook durable queue + reconciler
- Duplicate execution → lease token + idempotent completion
- Cross-rig attribution drift → strict work identity + immutable event trail
- Merge bottlenecks → dedicated refinery queue + bounded concurrency