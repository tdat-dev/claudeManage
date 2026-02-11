# TownUI — Complete Codebase Architecture Memory

## Overview
TownUI is a **Tauri 2 desktop app** for orchestrating multiple AI coding agents via a GUI.
- **Frontend**: React 18 + TypeScript + Tailwind CSS, bundled by Vite (port 1420)
- **Backend**: Rust (Tauri), exposes commands via `@tauri-apps/api/core` `invoke()`
- **Persistence**: JSON files in `~/.townui/` (rigs.json, crews.json, tasks.json, workers.json, runs.json, settings.json, logs/)

## Frontend Structure (`src/`)

### Entry
- `main.tsx` — React entry, renders `<App />`
- `App.tsx` — Root component, manages top-level routing/state, orchestrates all pages
- `index.css` — Tailwind imports + custom town-* theme

### Components
| Component | Purpose |
|---|---|
| `Layout.tsx` | 3-column layout: nav rail → sidebar (RigList) → main content |
| `RigList.tsx` | Sidebar list of rigs (projects/git repos) |
| `RigDetails.tsx` | Main panel showing rig info, crews, workers |
| `RigCreateDialog.tsx` | Dialog to create a new rig (select folder) |
| `CrewList.tsx` | List of crews (worktrees/branches) for a rig |
| `CrewCreateDialog.tsx` | Dialog to create a new crew (branch + worktree) |
| `WorkerPanel.tsx` | Worker list + spawn form with **33 agent types** in grouped `<optgroup>` |
| `TaskBoard.tsx` | Task management board (create, list, assign) |
| `TaskCreateDialog.tsx` | Dialog to create tasks |
| `TaskExecuteDialog.tsx` | Dialog to execute task with agent selection (**33 agent types**) |
| `LogViewer.tsx` | Terminal-like log viewer with search |
| `TerminalTabs.tsx` | Tabbed terminal view for multiple log streams |
| `RunHistory.tsx` | Run history list with status, duration, diff stats |
| `SettingsPage.tsx` | Settings: CLI paths, env vars, default template |

### Hooks
| Hook | Purpose |
|---|---|
| `useRigs.ts` | CRUD for rigs, calls tauri.ts functions |
| `useCrews.ts` | CRUD for crews (worktrees) |
| `useWorkers.ts` | Spawn/stop workers, get logs |
| `useTasks.ts` | CRUD for tasks |
| `useSettings.ts` | Load/save app settings |

### Tauri Bridge (`src/lib/tauri.ts`)
Types: `RigInfo`, `CrewInfo`, `WorkerInfo`, `TaskItem`, `RunInfo`, `LogEntry`, `AppSettings`, `TemplateInfo`
Functions: `listRigs`, `createRig`, `getRig`, `deleteRig`, `listCrews`, `createCrew`, `getCrew`, `deleteCrew`, `spawnWorker`, `stopWorker`, `getWorkerStatus`, `getWorkerLogs`, `listWorkers`, `listTasks`, `createTask`, `updateTask`, `deleteTask`, `executeTask`, `listRuns`, `getRun`, `getRunLogs`, `getSettings`, `updateSettings`, `validateCliPath`, `listTemplates`, `renderTemplate`, `listBranches`

## Backend Structure (`src-tauri/src/`)

### Core
- `main.rs` — Tauri main entry
- `lib.rs` — Tauri builder, registers all commands + AppState
- `state.rs` — `AppState` with `Mutex<Vec<T>>` for rigs, crews, workers, tasks, runs, settings + JSON persistence
- `git.rs` — Shell to `git` CLI for branch/status/diff info
- `templates.rs` — Built-in prompt templates (implement_feature, fix_bug, write_tests, refactor)

### Models (`src-tauri/src/models/`)
- `rig.rs` — `Rig` struct (id, name, path, created_at)
- `crew.rs` — `Crew` struct (id, rig_id, name, path, branch, is_worktree, created_at)
- `worker.rs` — `Worker`, `LogEntry`, `Run`, `WorkerStatusEnum`, `RunStatus`
- `task.rs` — `TaskItem` (id, rig_id, title, description, tags, priority, status, assigned_to, created_at, updated_at)
- `settings.rs` — `AppSettings` (cli_paths: HashMap, env_vars: HashMap, default_template)

### Commands (`src-tauri/src/commands/`)
- `rigs.rs` — CRUD for rigs
- `crews.rs` — Create/list/get/delete crews (git worktree management)
- `workers.rs` — `spawn_worker`, `stop_worker`, `list_workers`, `get_worker_status`, `get_worker_logs`, `execute_task`, `list_runs`, `get_run`, `get_run_logs`, `open_in_explorer`
- `tasks.rs` — CRUD for tasks
- `settings.rs` — Load/save settings, validate CLI paths
- `templates.rs` — List/render templates

## Supported AI Coding CLIs (33 total)

### Major Providers
| Key | CLI Name | Default Binary | Args Pattern |
|---|---|---|---|
| claude | Claude Code (Anthropic) | `claude` | `--print <prompt>` |
| codex | Codex CLI (OpenAI) | `codex` | `--quiet <prompt>` |
| chatgpt | ChatGPT CLI (OpenAI) | `chatgpt` | `--prompt <prompt>` |
| gemini | Gemini CLI (Google) | `gemini` | `--prompt <prompt>` |
| copilot | GitHub Copilot CLI | `gh` | `copilot suggest <prompt>` |
| amazon-q | Amazon Q Developer | `q` | `chat <prompt>` |

### Open-Source Agents
| Key | CLI Name | Default Binary | Args Pattern |
|---|---|---|---|
| aider | Aider | `aider` | `--message <prompt> --yes-always --no-git` |
| goose | Goose (Block) | `goose` | `session --message <prompt>` |
| openhands | OpenHands | `openhands` | `run --task <prompt>` |
| swe-agent | SWE-Agent | `swe-agent` | `run --task <prompt>` |
| mentat | Mentat | `mentat` | `--prompt <prompt>` |
| gpt-engineer | GPT Engineer | `gpte` | `--prompt <prompt>` |
| cline | Cline | `cline` | `--message <prompt>` |
| continue | Continue | `continue` | `--prompt <prompt>` |
| tabby | Tabby | `tabby` | `chat <prompt>` |
| roo | Roo Code | `roo` | `--message <prompt>` |
| sweep | Sweep AI | `sweep` | `run <prompt>` |
| auto-coder | Auto-Coder | `auto-coder` | `--task <prompt>` |

### IDE Agents (CLI mode)
| Key | CLI Name | Default Binary |
|---|---|---|
| cursor | Cursor | `cursor` |
| windsurf | Windsurf (Codeium) | `windsurf` |
| trae | Trae (ByteDance) | `trae` |
| augment | Augment Code | `augment` |
| pear | PearAI | `pear` |
| void | Void Editor | `void` |

### Code Assistants
| Key | CLI Name | Default Binary |
|---|---|---|
| cody | Cody (Sourcegraph) | `cody` |
| tabnine | Tabnine | `tabnine` |
| supermaven | Supermaven | `supermaven` |
| codestory | CodeStory / Aide | `codestory` |
| double | Double | `double` |

### Cloud Agents
| Key | CLI Name | Default Binary |
|---|---|---|
| devin | Devin (Cognition) | `devin` |
| replit | Replit Agent | `replit` |
| bolt | Bolt.new | `bolt` |

### Other
| Key | CLI Name | Default Binary |
|---|---|---|
| custom | Custom Command | (user-defined) |

## Key Patterns
- **Adding a new CLI**: Add to `settings.rs` default cli_paths → Add match arm in `workers.rs` spawn_worker_inner → Add `<option>` in WorkerPanel.tsx + TaskExecuteDialog.tsx
- **Adding a new Tauri command**: Rust fn in commands/ → Register in lib.rs `generate_handler![]` → TS wrapper in tauri.ts
- **Styling**: Custom `town-*` palette in tailwind.config.js, dark theme only
- **Layout**: 3-column in Layout.tsx: nav rail → sidebar → main content
