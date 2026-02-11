# TownUI - Style & Conventions

## Rust Backend
- Standard Rust naming: `snake_case` for functions/variables, `PascalCase` for types/structs
- Tauri commands use `#[tauri::command]` attribute
- Models derive `Serialize, Deserialize, Clone`
- State management: `AppState` with `Mutex<Vec<T>>` for each entity type
- JSON persistence: `save_json()` / `load_json_vec()` in state.rs

## TypeScript Frontend
- React functional components with TypeScript
- Hooks pattern: custom hooks in `src/hooks/` for each entity (useRigs, useTasks, etc.)
- Tauri IPC wrappers in `src/lib/tauri.ts` — typed `invoke()` calls
- Tailwind CSS with custom `town-*` color palette (dark theme only)
- Colors: `bg-town-bg`, `text-town-accent`, `border-town-border`, etc.

## Code Organization
- Commands grouped by entity in `src-tauri/src/commands/`
- Models grouped by entity in `src-tauri/src/models/`
- Frontend components in `src/components/`
- Frontend hooks in `src/hooks/`

## Guidelines (from CLAUDE.md)
- Prefer Serena symbolic tools over file-based tools
- Use `get_symbols_overview` → `find_symbol` → `replace_symbol_body` workflow
- Adding new Tauri command: 3 places (Rust command, generate_handler, TS wrapper)
