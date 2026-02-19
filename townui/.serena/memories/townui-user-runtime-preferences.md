# User Runtime Preferences (Windows)

- For Codex CLI on Windows, always resolve and prefer `C:\\Users\\tvmar\\AppData\\Roaming\\npm\\codex.cmd` when available.
- If resolving via `where codex`, prioritize executable/script extensions in this order: `.cmd`, `.exe`, `.bat`, `.ps1`.
- Avoid launching extensionless shims directly on Windows to prevent `%1 is not a valid Win32 application (os error 193)`.
- For Codex in this project, prefer non-PTY process spawning on Windows and stream stdout/stderr directly.
- Keep failure logging enabled with explicit exit-code/system-error entries in worker logs.

This preference should be treated as the default behavior for future Codex-related fixes in this project unless the user asks otherwise.