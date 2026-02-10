# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tool Priority: Always Use Serena

This project uses Serena (MCP server) for all code operations. **Always prefer Serena's symbolic tools over file-based tools (Read, Edit, Write, Grep, Glob).**

**Reading code — use Serena first:**
- `get_symbols_overview` to understand a file's structure before diving in
- `find_symbol` with `include_body=True` to read specific functions/classes — never `Read` an entire file unless strictly necessary
- `find_symbol` with `depth=1` to list methods of a class before reading individual ones
- `find_referencing_symbols` to trace where a symbol is used across the codebase
- `search_for_pattern` for flexible regex search in code or non-code files

**Editing code — use Serena first:**
- `replace_symbol_body` to replace an entire function/method/class body
- `insert_after_symbol` / `insert_before_symbol` to add new code adjacent to existing symbols
- `rename_symbol` for project-wide renames (updates all references automatically)

**When to fall back to basic tools:**
- Non-code files (JSON, TOML, CSS, config files) where Serena has no symbol data
- Very small edits within a large function where replacing the whole body is wasteful
- File creation (`Write`) — Serena cannot create new files

**Workflow pattern:**
1. `get_symbols_overview` → understand the file
2. `find_symbol` with `depth=1` → find the right symbol
3. `find_symbol` with `include_body=True` → read only what you need
4. `replace_symbol_body` or `insert_after_symbol` → make precise edits
5. `find_referencing_symbols` → verify no references are broken

## What is TownUI

TownUI is a Tauri 2 desktop application for managing local git repositories ("rigs"). It uses a React/TypeScript frontend with a Rust backend. Data is persisted to `~/.townui/rigs.json`.

## Development Commands

```bash
# Install frontend dependencies (run from townui/)
npm install

# Run in development mode (starts both Vite dev server and Tauri)
npm run tauri dev

# Production build
npm run tauri build

# Frontend-only dev server (no Tauri shell, port 1420)
npm run dev

# Type-check frontend
npx tsc --noEmit

# Check Rust code
cd src-tauri && cargo check
```

## Architecture

**Two-process Tauri 2 app:**
- **Frontend** (`src/`): React 18 + TypeScript + Tailwind CSS, bundled by Vite (port 1420)
- **Backend** (`src-tauri/`): Rust, exposes Tauri commands that the frontend calls via `@tauri-apps/api/core` `invoke()`

**Frontend → Backend communication:**
- `src/lib/tauri.ts` — typed wrappers around `invoke()` for all Tauri commands (`list_rigs`, `create_rig`, `get_rig`, `delete_rig`)
- `src/hooks/useRigs.ts` — React hook managing rig state, calls the tauri.ts functions
- Components receive data and callbacks via props from `App.tsx`

**Backend modules:**
- `src-tauri/src/lib.rs` — Tauri builder setup, registers all commands and `AppState`
- `src-tauri/src/state.rs` — `AppState` holds `Mutex<Vec<Rig>>` and handles JSON persistence to `~/.townui/rigs.json`
- `src-tauri/src/commands/rigs.rs` — all `#[tauri::command]` handlers
- `src-tauri/src/models/rig.rs` — `Rig` (persisted) and `RigInfo` (with git data, sent to frontend)
- `src-tauri/src/git.rs` — shells out to `git` CLI for branch/status info

**Adding a new Tauri command requires changes in three places:**
1. Rust command function in `src-tauri/src/commands/rigs.rs` (or new module)
2. Register it in `tauri::generate_handler![]` in `src-tauri/src/lib.rs`
3. TypeScript wrapper in `src/lib/tauri.ts`

## Styling

Uses a custom `town-*` color palette defined in `tailwind.config.js`. All colors use this namespace (e.g., `bg-town-bg`, `text-town-accent`, `border-town-border`). Dark theme only.

## Layout Structure

Three-column layout in `Layout.tsx`: narrow nav rail (left) → sidebar with rig list (middle) → main content area (right). Nav items Tasks, Runs, and Settings exist in the UI but are not yet implemented.
