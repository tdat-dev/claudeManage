# TownUI - Task Completion Checklist

When a coding task is completed, verify:

## Rust Backend
- [ ] `cargo check` passes (no compilation errors)
- [ ] `cargo clippy` has no warnings
- [ ] `cargo fmt` applied (code formatted)
- [ ] New commands registered in `tauri::generate_handler![]` in `lib.rs`
- [ ] State persistence calls (save_*) added for data mutations

## TypeScript Frontend
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] New Tauri commands have typed wrappers in `src/lib/tauri.ts`
- [ ] Components follow existing patterns (hooks, props, Tailwind)

## General
- [ ] No hardcoded paths (use `~/.townui/` via home_dir())
- [ ] Backward compatibility maintained or references updated
- [ ] Test the feature via `npm run tauri dev`
