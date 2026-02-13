# TownUI - Style & Conventions

## Rust Backend
- Standard Rust naming: `snake_case` for functions/variables, `PascalCase` for types/structs
- Tauri commands use `#[tauri::command]` attribute
- Models derive `Serialize, Deserialize, Clone`
- State management: `AppState` with `Mutex<Vec<T>>` for each entity type
- JSON persistence: `save_json()` / `load_json_vec()` in state.rs
- Audit events: append-only JSONL file, use `append_audit_event()` in state.rs

## TypeScript Frontend
- React functional components with TypeScript
- Hooks pattern: custom hooks in `src/hooks/` for each entity (useRigs, useTasks, useHooks, useHandoffs, useAuditLog, etc.)
- Tauri IPC wrappers in `src/lib/tauri.ts` — typed `invoke()` calls
- Tailwind CSS with custom `town-*` color palette (dark theme only)
- Colors: `bg-town-bg`, `text-town-accent`, `border-town-border`, etc.

## Code Organization
- Commands grouped by entity in `src-tauri/src/commands/`
- Models grouped by entity in `src-tauri/src/models/`
- Frontend components in `src/components/`
- Frontend hooks in `src/hooks/`

## Adding New Features Pattern
1. **Model**: Create `models/entity.rs`, add to `models/mod.rs`
2. **State**: Add `Mutex<Vec<Entity>>` to `AppState` in `state.rs`, add persistence fns
3. **Commands**: Create `commands/entity.rs`, add to `commands/mod.rs`
4. **Register**: Add commands to `tauri::generate_handler![]` in `lib.rs`
5. **TS Types**: Add types + invoke wrappers in `src/lib/tauri.ts`
6. **Hook**: Create `hooks/useEntity.ts`
7. **Component**: Create `components/EntityView.tsx`
8. **Layout**: Add nav entry in `Layout.tsx`

## Task Status Values
`Pending | InProgress | Done | Blocked | Deferred | Escalated | Cancelled`

## Guidelines (from CLAUDE.md)
- Prefer Serena symbolic tools over file-based tools
- Use `get_symbols_overview` → `find_symbol` → `replace_symbol_body` workflow
- Adding new Tauri command: 3 places (Rust command, generate_handler, TS wrapper)