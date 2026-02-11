# TownUI - Project Structure

```
claudeManage/
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
│   │   │   ├── RigDetails.tsx      # Rig detail view
│   │   │   ├── RigCreateDialog.tsx # Create rig dialog
│   │   │   ├── TaskBoard.tsx       # Task board view
│   │   │   ├── TaskCreateDialog.tsx# Create task dialog
│   │   │   ├── TaskExecuteDialog.tsx# Execute task dialog
│   │   │   ├── CrewList.tsx        # Crew listing
│   │   │   ├── CrewCreateDialog.tsx# Create crew dialog
│   │   │   ├── WorkerPanel.tsx     # Worker management panel
│   │   │   ├── RunHistory.tsx      # Run history view
│   │   │   ├── LogViewer.tsx       # Log viewer
│   │   │   └── SettingsPage.tsx    # Settings page
│   │   │
│   │   ├── hooks/
│   │   │   ├── useRigs.ts          # Rig state management
│   │   │   ├── useTasks.ts         # Task state management
│   │   │   ├── useCrews.ts         # Crew state management
│   │   │   ├── useWorkers.ts       # Worker state management
│   │   │   └── useSettings.ts      # Settings state management
│   │   │
│   │   └── lib/
│   │       └── tauri.ts            # Typed wrappers around invoke()
│   │
│   └── src-tauri/                  # Backend (Rust / Tauri 2)
│       ├── Cargo.toml              # Rust dependencies
│       ├── Cargo.lock
│       ├── tauri.conf.json         # Tauri config
│       │
│       └── src/
│           ├── main.rs             # Rust entry point
│           ├── lib.rs              # Tauri builder, registers commands & AppState
│           ├── state.rs            # AppState: Mutex<Vec<T>>, JSON persistence
│           ├── git.rs              # Git CLI integration (branch/status)
│           ├── templates.rs        # Template management
│           │
│           ├── commands/
│           │   ├── mod.rs          # Module declarations
│           │   ├── rigs.rs         # Rig CRUD commands
│           │   ├── tasks.rs        # Task CRUD commands
│           │   ├── crews.rs        # Crew commands
│           │   ├── workers.rs      # Worker commands
│           │   ├── templates.rs    # Template commands
│           │   └── settings.rs     # Settings commands
│           │
│           └── models/
│               ├── mod.rs          # Module declarations
│               ├── rig.rs          # Rig & RigInfo structs
│               ├── task.rs         # Task struct (id, title, status, priority)
│               ├── crew.rs         # Crew struct
│               ├── worker.rs       # Worker struct
│               └── settings.rs     # Settings struct
```

## Architecture Pattern
- **Adding a new Tauri command requires 3 changes:**
  1. Rust command fn in `src-tauri/src/commands/*.rs`
  2. Register in `tauri::generate_handler![]` in `src-tauri/src/lib.rs`
  3. TypeScript wrapper in `src/lib/tauri.ts`

## Layout
Three-column layout: narrow nav rail (left) → sidebar (middle) → main content (right)
