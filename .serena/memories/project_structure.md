# Project Structure

## Backend (src-tauri/src/)
- main.rs, lib.rs (command registration), state.rs (AppState + persistence)
- models/: actor.rs, audit.rs, convoy.rs, crew.rs, handoff.rs, hook.rs, mod.rs, rig.rs, settings.rs, task.rs, worker.rs
- commands/: actors.rs, audit.rs, convoys.rs, crews.rs, handoffs.rs, hooks.rs, mod.rs, rigs.rs, settings.rs, tasks.rs, templates.rs, workers.rs
- git.rs (git operations), templates.rs (prompt templates)

## Frontend (src/)
- App.tsx (root routing), main.tsx, index.css
- components/: AuditTimeline, ConvoyBoard, CrewCreateDialog, CrewList, HandoffCenter, HookInbox, Layout, LogViewer, RigCreateDialog, RigDetails, RigList, RunHistory, SettingsPage, TaskBoard (Kanban), TaskCreateDialog, TaskExecuteDialog, TerminalTabs, WorkerPanel
- hooks/: useAuditLog, useConvoys, useCrews, useHandoffs, useHooks, useRigs, useSettings, useTasks, useWorkers
- lib/: i18n.ts (EN/VI), tauri.ts (types + invoke wrappers)

## Persistence (~/.townui/)
- rigs.json, crews.json, tasks.json, hooks.json, handoffs.json, convoys.json, actors.json, workers.json, runs.json, settings.json, audit_events.jsonl
- logs/ (worker log files), worktrees/, templates/
