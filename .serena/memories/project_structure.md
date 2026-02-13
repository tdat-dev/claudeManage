# TownUI - Project Structure

```
claudeManage/
├── note.md                         # Original product spec & prompts
├── docs/
│   ├── gastown-for-claudemanage.md             # Gas Town architecture reference
│   ├── gastown-comprehensive-for-claudemanage.md # Detailed Gas Town reference
│   └── implementation-tasklist.md              # Implementation progress tracker
│
├── townui/                         # Main app directory
│   ├── CLAUDE.md                   # Claude Code guidelines
│   ├── package.json                # Node deps (React, Tauri API, Vite, Tailwind)
│   ├── tailwind.config.js          # Custom town-* color palette
│   ├── vite.config.ts              # Vite config
│   ├── tsconfig.json               # TypeScript config
│   ├── index.html                  # Entry HTML
│   │
│   ├── src/                        # Frontend (React + TypeScript)
│   │   ├── main.tsx                # React entry point
│   │   ├── App.tsx                 # Root component, routing & state
│   │   ├── index.css               # Global styles
│   │   │
│   │   ├── components/
│   │   │   ├── Layout.tsx          # 3-column layout (nav rail + sidebar + main)
│   │   │   ├── RigList.tsx         # Rig listing sidebar
│   │   │   ├── RigDetails.tsx      # Rig detail view with tabs
│   │   │   ├── RigCreateDialog.tsx # Create rig dialog
│   │   │   ├── TaskBoard.tsx       # Task board with Pending/InProgress/Done/Blocked/Deferred/Escalated lanes
│   │   │   ├── TaskCreateDialog.tsx# Create task dialog (includes acceptance_criteria)
│   │   │   ├── TaskExecuteDialog.tsx# Execute task dialog
│   │   │   ├── CrewList.tsx        # Crew listing
│   │   │   ├── CrewCreateDialog.tsx# Create crew dialog
│   │   │   ├── WorkerPanel.tsx     # Worker management panel
│   │   │   ├── TerminalTabs.tsx    # Multi-terminal tabs for workers
│   │   │   ├── RunHistory.tsx      # Run history view
│   │   │   ├── LogViewer.tsx       # Log viewer
│   │   │   ├── AuditTimeline.tsx   # Audit event timeline (Phase 1)
│   │   │   ├── HookInbox.tsx       # Per-agent hook queue view (Phase 2)
│   │   │   ├── HandoffCenter.tsx   # Handoff pending/accepted list (Phase 2)
│   │   │   └── SettingsPage.tsx    # Settings page
│   │   │
│   │   ├── hooks/
│   │   │   ├── useRigs.ts          # Rig state management
│   │   │   ├── useTasks.ts         # Task state management
│   │   │   ├── useCrews.ts         # Crew state management
│   │   │   ├── useWorkers.ts       # Worker state management
│   │   │   ├── useSettings.ts      # Settings state management
│   │   │   ├── useAuditLog.ts      # Audit event state management (Phase 1)
│   │   │   ├── useHooks.ts         # Hook state management (Phase 2)
│   │   │   └── useHandoffs.ts      # Handoff state management (Phase 2)
│   │   │
│   │   └── lib/
│   │       ├── tauri.ts            # Typed wrappers around invoke() for all commands
│   │       └── i18n.ts             # Internationalization
│   │
│   └── src-tauri/                  # Backend (Rust / Tauri 2)
│       ├── Cargo.toml              # Rust dependencies
│       ├── tauri.conf.json         # Tauri config
│       │
│       └── src/
│           ├── main.rs             # Rust entry point
│           ├── lib.rs              # Tauri builder, registers commands & AppState
│           ├── state.rs            # AppState: Mutex<Vec<T>>, JSON persistence + Hook/Handoff/Audit state
│           ├── git.rs              # Git CLI integration (branch/status/worktree)
│           ├── templates.rs        # Template management
│           │
│           ├── commands/
│           │   ├── mod.rs          # Module declarations
│           │   ├── rigs.rs         # Rig CRUD commands
│           │   ├── tasks.rs        # Task CRUD commands (extended with acceptance_criteria, dependencies, etc.)
│           │   ├── crews.rs        # Crew commands
│           │   ├── workers.rs      # Worker spawn/stop commands
│           │   ├── templates.rs    # Template commands
│           │   ├── settings.rs     # Settings commands
│           │   ├── audit.rs        # Audit event commands (list_events, get_events_for_task)
│           │   ├── hooks.rs        # Hook commands (create_hook, assign_to_hook, sling, done, list_hooks)
│           │   └── handoffs.rs     # Handoff commands (create_handoff, accept_handoff, list_handoffs)
│           │
│           └── models/
│               ├── mod.rs          # Module declarations
│               ├── rig.rs          # Rig & RigInfo structs
│               ├── task.rs         # Task struct (extended: acceptance_criteria, dependencies, blocked_reason, convoy_id, hook_id, etc.)
│               ├── crew.rs         # Crew struct
│               ├── worker.rs       # Worker struct
│               ├── settings.rs     # Settings struct
│               ├── audit.rs        # AuditEvent struct (event_id, actor_id, work_item_id, event_type, payload_json, emitted_at)
│               ├── hook.rs         # Hook struct (hook_id, attached_actor_id, current_work_id, state_blob, last_heartbeat)
│               └── handoff.rs      # Handoff struct (handoff_id, from_actor_id, to_actor_id, work_item_id, context_summary, blockers, next_steps)
```

## Architecture Pattern
- **Adding a new Tauri command requires 3 changes:**
  1. Rust command fn in `src-tauri/src/commands/*.rs`
  2. Register in `tauri::generate_handler![]` in `src-tauri/src/lib.rs`
  3. TypeScript wrapper in `src/lib/tauri.ts`

## Layout
Three-column layout: narrow nav rail (left) → sidebar (middle) → main content (right)
Nav items: Rigs, Tasks, Hooks, Handoffs, Audit, Runs, Settings