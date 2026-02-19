Prompt 0 — System/Role (dán vào “System” nếu tool cho)
You are a senior Windows desktop engineer + platform architect. Build production-quality software with strong UX, robust error handling, and clear documentation. Prefer simple, debuggable designs. Always propose a milestone plan and deliver working code incrementally.

Prompt 1 — Product Spec (Prompt chính để tạo phần mềm)
Project: "TownUI" — a Windows desktop application that provides a graphical UI to orchestrate multiple AI coding agents and workflows, inspired by GasTown (rigs/crews/agents), but simpler and usable by non-terminal users.

Goal

- Provide a Windows-first UI app to manage:
  1. Projects ("Rigs") that map to local git repositories
  2. Workspaces/branches ("Crews") per project
  3. Agent sessions ("Workers") running external CLIs (Claude Code CLI, Codex CLI, etc.) via a pluggable adapter system
  4. Task board / issue list (lightweight) with run history and logs
- The app must run on Windows 10/11 and be installable as a single installer.

Key User Flows

1. Create/Open Rig:
   - User selects a local folder containing a git repo.
   - App shows repo info (branch, status), validates git installed.
   - Rig metadata stored locally.
2. Create Crew:
   - Create a new branch from base (main/master or selected branch).
   - Checkout into a dedicated working directory (or worktree).
   - Display crew status, last run, changes.
3. Spawn Worker:
   - User selects an agent type (Claude Code, Codex, “Custom command”).
   - User selects scope (current crew).
   - App launches the CLI in the crew workdir, captures stdio logs, and shows them live.
   - Provide “Stop/Restart”, and persistence of logs.
4. Task Board:
   - User creates tasks (title, description, tags, priority).
   - Assign tasks to workers; run “Execute task” which feeds a prompt template to the CLI.
   - Store artifacts: logs, changed files summary (git diff stats), output notes.
5. Settings:
   - Configure CLI paths, environment variables, API keys (stored securely).
   - Configure default prompt templates per agent.

Non-Goals (v1)

- No cloud multi-machine orchestration.
- No tmux requirement.
- No advanced beads integration.

Architecture Requirements

- Use a local “Town” directory to store state:
  - rigs.json, crews.json, tasks.json
  - logs/ (per run)
  - templates/
- Use git worktrees for crews to avoid heavy clones.
- Provide an Adapter interface for agents:
  - start(command, args, cwd, env) -> process handle
  - send(input) (optional, if interactive)
  - stop()
  - healthcheck()
- Use a structured event log for each run (JSONL) + a plain text stream.

Technology Choice
Pick one:
A) .NET 8 + WPF (MVVM) or WinUI 3
B) Tauri + React (desktop) with Rust backend
Choose the simplest to deliver on Windows with strong UI and process control. Justify briefly.

Security

- Store secrets with Windows Credential Manager (or DPAPI).
- Never log secrets.

Deliverables (must produce)

1. Repo structure with all source code
2. Build instructions for Windows
3. Installer packaging approach (MSIX or Squirrel or WiX)
4. A working MVP with:
   - Rig list screen
   - Rig details with crews list
   - Create crew (git worktree)
   - Worker runner with live logs
   - Task list + run task -> capture logs
5. Documentation: README + screenshots placeholders

Implementation Plan

- Provide milestones (M1..M4) and tasks.
- For each milestone, produce code in small batches with tests where feasible.
- Provide commands to run/build.

UX

- Clean minimal UI:
  - Left nav: Rigs, Tasks, Runs, Settings
  - Main panel: details
  - Terminal-like log viewer with search
- Avoid clutter; keyboard shortcuts.

Compatibility

- Assume user installs Git and agent CLIs separately; app must detect them and guide user to configure paths.

Now start by:

1. Picking the technology (A or B) with rationale
2. Generating the repo scaffolding (folders/files)
3. Implementing MVP Milestone M1 fully with code and run instructions
4. Output everything as file contents ready to paste into a repo.

Prompt 2 — Agent Adapter Spec (để AI viết đúng “plugin system”)
Design and implement an "Agent Adapter" plugin system.

Adapters:

- ClaudeCodeAdapter (runs "claude" CLI)
- CustomCommandAdapter (any exe path)
- Future: OpenAI Codex CLI adapter

Each adapter must implement:

- Validate(): checks binary exists and returns version output
- StartSession(cwd, env, initialPrompt): starts process, wires stdout/stderr streaming
- Send(text): optional; send to stdin if interactive
- Stop(): graceful then kill after timeout
- GetSessionState(): running/exited, exit code, last output timestamp

The core app must not know agent specifics beyond adapter interface.
Store adapter configs in Settings (path, args, env overrides, prompt templates).

Prompt 3 — Git Worktree Spec (để “Crew” chạy chuẩn)
Implement "Crew" as a git worktree.

Given a rig repo path:

- List existing worktrees (git worktree list --porcelain)
- Create crew:
  - Choose base branch
  - Create new branch name: crew/<slug>
  - git worktree add <townDir>/worktrees/<rigId>/<crewName> -b <branchName> <baseBranch>
- Remove crew:
  - git worktree remove <path> --force
  - delete branch optional
    Show status:
- git status --porcelain
- git branch --show-current
- last commit: git log -1

Prompt 4 — Prompt Templates cho “Run Task”
Create a templating system for task execution prompts.

Variables:

- {{task.title}}, {{task.description}}, {{rig.name}}, {{crew.branch}}, {{repo.root}}, {{files.changedSummary}}, {{constraints}}

Templates:

- "Implement feature"
- "Fix bug"
- "Write tests"
- "Refactor"

The app should render a prompt and pass it to the agent CLI as initial input.
Also store the rendered prompt into the run record.

Bonus: “Prompt quản lý dự án” để AI tự làm theo sprint
Work like a product team. Keep a TODO.md updated. For each commit-worthy change, provide:

- What changed
- How to run
- How to verify
  Use conventional commits. Keep code readable and modular.
