# TownUI - Project Overview

## Purpose
TownUI is a **Tauri 2 desktop application** for managing local git repositories ("rigs"). It provides a GUI to manage rigs, tasks, crews, workers, templates, and settings.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite (port 1420)
- **Backend**: Rust (Tauri 2)
- **IPC**: Frontend calls Rust commands via `@tauri-apps/api/core` `invoke()`
- **Persistence**: JSON files in `~/.townui/` (rigs.json, tasks.json, etc.)
- **Styling**: Custom `town-*` color palette in Tailwind, dark theme only

## Data Storage
All data persisted as JSON in `~/.townui/`:
- `rigs.json` — repositories
- `tasks.json` — tasks
- `worktrees/` — git worktrees
- `logs/` — worker logs
- `templates/` — templates
