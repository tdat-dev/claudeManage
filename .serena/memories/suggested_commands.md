# TownUI - Development Commands

## System: Windows

## Development
```bash
# Install frontend dependencies (run from townui/)
cd townui && npm install

# Run dev mode (starts Vite dev server + Tauri)
cd townui && npm run tauri dev

# Frontend-only dev server (port 1420, no Tauri shell)
cd townui && npm run dev

# Production build
cd townui && npm run tauri build
```

## Type Checking & Linting
```bash
# TypeScript type-check
cd townui && npx tsc --noEmit

# Rust check
cd townui/src-tauri && cargo check

# Rust clippy (linting)
cd townui/src-tauri && cargo clippy
```

## Formatting
```bash
# Rust formatting
cd townui/src-tauri && cargo fmt
```

## Utility Commands (Windows)
```powershell
# Git
git status / git diff / git log

# Directory listing
dir          # or: Get-ChildItem
ls           # works in PowerShell

# Search in files
findstr /s /i "pattern" *.rs    # Windows native
Select-String -Pattern "pattern" -Path "*.rs" -Recurse  # PowerShell
```
