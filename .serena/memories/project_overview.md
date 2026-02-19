# TownUI - Project Overview

## Purpose
TownUI is a **Tauri 2 desktop application** for managing local git repositories ("rigs") and orchestrating multiple AI coding agents. Inspired by Gas Town (rigs/crews/agents/hooks/convoys), it provides a graphical UI for non-terminal users on Windows.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite (port 1420)
- **Backend**: Rust (Tauri 2)
- **IPC**: Frontend calls Rust commands via `@tauri-apps/api/core` `invoke()`
- **Persistence**: JSON files in `~/.townui/` (rigs.json, tasks.json, hooks.json, handoffs.json, audit_events.jsonl, etc.)
- **Styling**: Custom `town-*` color palette in Tailwind, dark theme only

## Data Storage
All data persisted as JSON in `~/.townui/`:
- `rigs.json` — repositories
- `tasks.json` — tasks/work items with extended fields (acceptance_criteria, dependencies, convoy_id, hook_id, etc.)
- `hooks.json` — durable work queues per agent
- `handoffs.json` — task transfer records between agents
- `audit_events.jsonl` — append-only audit event log
- `worktrees/` — git worktrees for crews
- `logs/` — worker logs
- `templates/` — prompt templates

## Core Concepts (Gas Town Mapping)
- **Rig** = git repository/project
- **Crew** = git worktree/branch for parallel work
- **Worker** = agent session running external CLI (Claude Code, Codex, Custom)
- **Task** = durable work item (bead equivalent) with states: Pending, InProgress, Done, Blocked, Deferred, Escalated, Cancelled
- **Hook** = durable pinned work queue for an agent (execute immediately when assigned)
- **Handoff** = explicit task transfer between agents with context preservation
- **Convoy** = multi-task, often multi-rig objective container (planned, not yet implemented)
- **Audit Event** = immutable event trail for all state transitions

## Implementation Status (as of 2026-02-12)
- **Phase 1 (Durable Work Core)**: ~95% complete — Task model extended, audit log working, status machine expanded
- **Phase 2 (Hook & Handoff)**: ~95% complete — Hook and Handoff models + UI done, resume API backend pending
- **Phase 3 (Convoy & Cross-Rig)**: Not started — Convoy model, Actor/Identity model
- **Phase 4 (Workflow Engine)**: Not started — Formula/Molecule pattern
- **Phase 5 (Health & Operations)**: Not started — Health monitoring, failure center

## Key Bugs Fixed
- Codex CLI on Windows: PTY init failure (0xC0000142) → switched to non-PTY spawn
- Codex CLI: program not found → added Windows CLI path resolver
- Codex CLI: os error 193 → prioritized .cmd/.exe extension
- Worker fail log: added exit code to log output