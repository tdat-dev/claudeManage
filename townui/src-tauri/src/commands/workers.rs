use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::models::worker::{LogEntry, Run, RunStatus, Worker, WorkerStatusEnum};
use crate::state::AppState;

// ── Cross-platform helpers ──

#[cfg(target_os = "windows")]
fn kill_process_tree(pid: u32) {
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output();
}

#[cfg(target_os = "windows")]
fn resolve_windows_cli_path(cli: &str) -> Option<String> {
    let cli_lower = cli.to_ascii_lowercase();
    if cli.contains('\\') || cli.contains('/') || cli_lower.ends_with(".exe") || cli_lower.ends_with(".cmd") || cli_lower.ends_with(".bat") || cli_lower.ends_with(".ps1") {
        if std::path::Path::new(cli).exists() {
            return Some(cli.to_string());
        }
    }

    if let Ok(out) = Command::new("where").arg(cli).output() {
        if out.status.success() {
            if let Ok(stdout) = String::from_utf8(out.stdout) {
                let mut candidates: Vec<String> = stdout
                    .lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty())
                    .map(|line| line.to_string())
                    .collect();

                candidates.sort_by_key(|path| {
                    let lower = path.to_ascii_lowercase();
                    if lower.ends_with(".cmd") {
                        0
                    } else if lower.ends_with(".exe") {
                        1
                    } else if lower.ends_with(".bat") {
                        2
                    } else if lower.ends_with(".ps1") {
                        3
                    } else {
                        4
                    }
                });

                if let Some(found) = candidates.into_iter().find(|path| {
                    let lower = path.to_ascii_lowercase();
                    lower.ends_with(".cmd")
                        || lower.ends_with(".exe")
                        || lower.ends_with(".bat")
                        || lower.ends_with(".ps1")
                }) {
                    return Some(found);
                }

                if let Some(found) = stdout.lines().map(str::trim).find(|line| !line.is_empty()) {
                    let base = std::path::PathBuf::from(found);
                    if base.extension().is_none() {
                        for ext in ["cmd", "exe", "bat", "ps1"] {
                            let with_ext = base.with_extension(ext);
                            if with_ext.exists() {
                                return Some(with_ext.to_string_lossy().to_string());
                            }
                        }
                    }
                    return Some(found.to_string());
                }
            }
        }
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        let npm_dir = std::path::PathBuf::from(appdata).join("npm");
        let candidates = [
            npm_dir.join(format!("{}.cmd", cli)),
            npm_dir.join(format!("{}.ps1", cli)),
            npm_dir.join(format!("{}.exe", cli)),
        ];
        for path in candidates {
            if path.exists() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }

    None
}

#[cfg(target_os = "macos")]
fn kill_process_tree(pid: u32) {
    // Try process group kill first, fallback to direct kill
    let pgid_result = Command::new("kill")
        .args(["-9", &format!("-{}", pid)])
        .output();
    match pgid_result {
        Ok(o) if o.status.success() => {}
        _ => {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
    }
}

#[cfg(target_os = "linux")]
fn kill_process_tree(pid: u32) {
    // Try process group kill first, fallback to direct kill
    let pgid_result = Command::new("kill")
        .args(["-9", &format!("-{}", pid)])
        .output();
    match pgid_result {
        Ok(o) if o.status.success() => {}
        _ => {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn kill_process_tree(pid: u32) {
    eprintln!("kill_process_tree: unsupported platform, cannot kill pid {}", pid);
}

// ── Core spawn logic (via PTY so CLIs see a real terminal) ──

fn spawn_worker_inner(
    crew_id: String,
    agent_type: String,
    initial_prompt: String,
    app: AppHandle,
) -> Result<Worker, String> {
    let state = app.state::<AppState>();

    // Find crew to get its path and rig_id
    let crews = state.crews.lock().unwrap();
    let crew = crews
        .iter()
        .find(|c| c.id == crew_id)
        .ok_or_else(|| "Crew not found".to_string())?;
    let cwd = crew.path.clone();
    let rig_id = crew.rig_id.clone();
    drop(crews);

    // Resolve the CLI command
    let settings = state.settings.lock().unwrap();
    let cli_path = settings
        .cli_paths
        .get(&agent_type)
        .cloned()
        .unwrap_or_else(|| agent_type.clone());
    let env_vars = settings.env_vars.clone();
    drop(settings);

    #[cfg(target_os = "windows")]
    if agent_type == "codex" {
        let resolved_cli = resolve_windows_cli_path(&cli_path).ok_or_else(|| {
            format!(
                "Failed to spawn {}: program not found. Set full CLI path in Settings (e.g. C:\\Users\\<you>\\AppData\\Roaming\\npm\\codex.cmd)",
                cli_path
            )
        })?;

        let mut process = if resolved_cli.to_ascii_lowercase().ends_with(".ps1") {
            let mut p = Command::new("powershell");
            p.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &resolved_cli]);
            p
        } else if resolved_cli.to_ascii_lowercase().ends_with(".cmd")
            || resolved_cli.to_ascii_lowercase().ends_with(".bat")
        {
            let mut p = Command::new("cmd");
            p.args(["/C", &resolved_cli]);
            p
        } else {
            Command::new(&resolved_cli)
        };

        process.current_dir(&cwd);
        for (k, v) in &env_vars {
            process.env(k, v);
        }
        process.args(["exec", "--full-auto"]);
        if !initial_prompt.is_empty() {
            process.arg(&initial_prompt);
        }
        process.stdout(Stdio::piped());
        process.stderr(Stdio::piped());

        let mut child = process
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", cli_path, e))?;

        let pid = Some(child.id());

        let mut worker = Worker::new(rig_id, crew_id, agent_type);
        worker.pid = pid;
        let worker_id = worker.id.clone();

        let mut workers = state.workers.lock().unwrap();
        workers.push(worker.clone());
        state.save_workers(&workers);
        drop(workers);

        {
            let mut logs = state.worker_logs.lock().unwrap();
            logs.insert(worker_id.clone(), Vec::new());
        }

        if let Some(stdout) = child.stdout.take() {
            let app_reader_out = app.clone();
            let worker_id_reader_out = worker_id.clone();
            thread::Builder::new()
                .name(format!("worker-{}-stdout", &worker_id_reader_out[..8]))
                .spawn(move || {
                    let state = app_reader_out.state::<AppState>();
                    let buf_reader = BufReader::new(stdout);
                    for line in buf_reader.lines() {
                        if let Ok(line) = line {
                            let entry = LogEntry {
                                timestamp: chrono::Utc::now().to_rfc3339(),
                                stream: "stdout".to_string(),
                                line,
                            };
                            {
                                let mut logs = state.worker_logs.lock().unwrap();
                                if let Some(entries) = logs.get_mut(&worker_id_reader_out) {
                                    entries.push(entry.clone());
                                }
                            }
                            if let Err(e) =
                                app_reader_out.emit("worker-log", (&worker_id_reader_out, &entry))
                            {
                                eprintln!("Failed to emit worker-log stdout: {}", e);
                            }
                        }
                    }
                })
                .unwrap_or_else(|e| {
                    eprintln!("Failed to spawn stdout reader thread: {}", e);
                    panic!("Cannot read worker stdout");
                });
        }

        if let Some(stderr) = child.stderr.take() {
            let app_reader_err = app.clone();
            let worker_id_reader_err = worker_id.clone();
            thread::Builder::new()
                .name(format!("worker-{}-stderr", &worker_id_reader_err[..8]))
                .spawn(move || {
                    let state = app_reader_err.state::<AppState>();
                    let buf_reader = BufReader::new(stderr);
                    for line in buf_reader.lines() {
                        if let Ok(line) = line {
                            let entry = LogEntry {
                                timestamp: chrono::Utc::now().to_rfc3339(),
                                stream: "stderr".to_string(),
                                line,
                            };
                            {
                                let mut logs = state.worker_logs.lock().unwrap();
                                if let Some(entries) = logs.get_mut(&worker_id_reader_err) {
                                    entries.push(entry.clone());
                                }
                            }
                            if let Err(e) =
                                app_reader_err.emit("worker-log", (&worker_id_reader_err, &entry))
                            {
                                eprintln!("Failed to emit worker-log stderr: {}", e);
                            }
                        }
                    }
                })
                .unwrap_or_else(|e| {
                    eprintln!("Failed to spawn stderr reader thread: {}", e);
                    panic!("Cannot read worker stderr");
                });
        }

        let app_wait = app.clone();
        let worker_id_wait = worker_id.clone();
        thread::Builder::new()
            .name(format!("worker-{}-wait", &worker_id_wait[..8]))
            .spawn(move || {
                let exit_status = child.wait();
                let (final_status, exit_code) = match exit_status {
                    Ok(status) => {
                        let code = status.code();
                        match code {
                            Some(0) => (WorkerStatusEnum::Completed, Some(0)),
                            Some(c) => (WorkerStatusEnum::Failed, Some(c)),
                            None => (WorkerStatusEnum::Failed, None),
                        }
                    }
                    Err(_) => (WorkerStatusEnum::Failed, None),
                };

                let state = app_wait.state::<AppState>();

                if final_status == WorkerStatusEnum::Failed {
                    let failure_line = match exit_code {
                        Some(code) => format!("Process exited with non-zero code: {}", code),
                        None => "Process terminated unexpectedly (no exit code)".to_string(),
                    };
                    let failure_entry = LogEntry {
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        stream: "stderr".to_string(),
                        line: failure_line,
                    };

                    {
                        let mut logs = state.worker_logs.lock().unwrap();
                        if let Some(entries) = logs.get_mut(&worker_id_wait) {
                            entries.push(failure_entry.clone());
                        }
                    }

                    if let Err(e) = app_wait.emit("worker-log", (&worker_id_wait, &failure_entry)) {
                        eprintln!("Failed to emit worker-log failure entry: {}", e);
                    }
                }

                {
                    let mut workers = state.workers.lock().unwrap();
                    if let Some(w) = workers.iter_mut().find(|w| w.id == worker_id_wait) {
                        w.status = final_status.clone();
                        w.stopped_at = Some(chrono::Utc::now().to_rfc3339());
                    }
                    state.save_workers(&workers);
                }

                let crew_path = {
                    let runs = state.runs.lock().unwrap();
                    let crew_id = runs
                        .iter()
                        .find(|r| r.worker_id == worker_id_wait)
                        .map(|r| r.crew_id.clone());
                    drop(runs);

                    crew_id.and_then(|cid| {
                        let crews = state.crews.lock().unwrap();
                        crews.iter().find(|c| c.id == cid).map(|c| c.path.clone())
                    })
                };

                let diff_stats = crew_path.and_then(|path| crate::git::get_diff_stat(&path).ok());

                {
                    let run_status = match final_status {
                        WorkerStatusEnum::Completed => RunStatus::Completed,
                        _ => RunStatus::Failed,
                    };
                    let mut runs = state.runs.lock().unwrap();
                    if let Some(run) = runs.iter_mut().find(|r| r.worker_id == worker_id_wait) {
                        run.status = run_status;
                        run.finished_at = Some(chrono::Utc::now().to_rfc3339());
                        run.exit_code = exit_code;
                        run.diff_stats = diff_stats;
                    }
                    state.save_runs(&runs);
                }

                {
                    let mut logs = state.worker_logs.lock().unwrap();
                    if let Some(entries) = logs.remove(&worker_id_wait) {
                        state.save_log(&worker_id_wait, &entries);
                    }
                }

                if let Err(e) =
                    app_wait.emit("worker-status", (&worker_id_wait, format!("{:?}", final_status)))
                {
                    eprintln!("Failed to emit worker-status: {}", e);
                }
            })
            .unwrap_or_else(|e| {
                eprintln!("Failed to spawn wait thread: {}", e);
                panic!("Cannot wait on worker process");
            });

        return Ok(worker.clone());
    }

    // Build the command via portable-pty CommandBuilder.
    #[cfg(target_os = "windows")]
    let mut cmd = {
        if agent_type == "codex" {
            // Codex npm shim is more reliable under PowerShell in PTY mode on Windows.
            let mut c = CommandBuilder::new("powershell");
            c.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &cli_path]);
            c
        } else {
            // For generic npm-installed .cmd wrappers, resolve via cmd.exe /C.
            let mut c = CommandBuilder::new("cmd");
            c.args(["/C", &cli_path]);
            c
        }
    };
    #[cfg(not(target_os = "windows"))]
    let mut cmd = CommandBuilder::new(&cli_path);

    cmd.cwd(&cwd);

    // Add environment variables
    for (k, v) in &env_vars {
        cmd.env(k, v);
    }

    // Agent-specific argument patterns
    match agent_type.as_str() {
        "claude" => { cmd.args(["--print", &initial_prompt]); }
        "codex" => {
            cmd.args(["exec", "--full-auto"]);
            if !initial_prompt.is_empty() { cmd.arg(&initial_prompt); }
        }
        "chatgpt" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "gemini" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "copilot" => { cmd.args(["copilot", "suggest", &initial_prompt]); }
        "amazon-q" => { cmd.args(["chat", &initial_prompt]); }
        "aider" => { cmd.args(["--message", &initial_prompt, "--yes-always", "--no-git"]); }
        "goose" => { cmd.args(["session", "--message", &initial_prompt]); }
        "openhands" => { cmd.args(["run", "--task", &initial_prompt]); }
        "swe-agent" => { cmd.args(["run", "--task", &initial_prompt]); }
        "mentat" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "gpt-engineer" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "cline" => { cmd.args(["--message", &initial_prompt]); }
        "continue" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "tabby" => { cmd.args(["chat", &initial_prompt]); }
        "roo" => { cmd.args(["--message", &initial_prompt]); }
        "sweep" => { cmd.args(["run", &initial_prompt]); }
        "auto-coder" => { cmd.args(["--task", &initial_prompt]); }
        "cursor" => { cmd.args(["--prompt", &initial_prompt]); }
        "windsurf" => { cmd.args(["--prompt", &initial_prompt]); }
        "trae" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "augment" => { cmd.args(["--message", &initial_prompt]); }
        "pear" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "void" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "cody" => { cmd.args(["chat", "--message", &initial_prompt]); }
        "tabnine" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "supermaven" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "codestory" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "double" => { if !initial_prompt.is_empty() { cmd.args(["--prompt", &initial_prompt]); } }
        "devin" => { cmd.args(["run", "--task", &initial_prompt]); }
        "replit" => { cmd.args(["agent", "--task", &initial_prompt]); }
        "bolt" => { cmd.args(["--prompt", &initial_prompt]); }
        _ => { if !initial_prompt.is_empty() { cmd.arg(&initial_prompt); } }
    }

    // Open a pseudo-terminal pair — this gives the child process a real TTY
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Spawn process on the slave end of the PTY
    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn {}: {}", cli_path, e))?;

    // Get PID — portable-pty child exposes process_id()
    let pid = child.process_id();

    let mut worker = Worker::new(rig_id, crew_id, agent_type);
    worker.pid = pid;
    let worker_id = worker.id.clone();

    let mut workers = state.workers.lock().unwrap();
    workers.push(worker.clone());
    state.save_workers(&workers);
    drop(workers);

    // Initialize logs for this worker
    {
        let mut logs = state.worker_logs.lock().unwrap();
        logs.insert(worker_id.clone(), Vec::new());
    }

    // Drop the slave side — we only need the master to read output
    drop(pair.slave);

    // Get a reader from the PTY master (combined stdout+stderr)
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    // Spawn a thread to read PTY output (stdout+stderr are merged in PTY)
    let app_reader = app.clone();
    let worker_id_reader = worker_id.clone();
    thread::Builder::new()
        .name(format!("worker-{}-pty", &worker_id_reader[..8]))
        .spawn(move || {
            let state = app_reader.state::<AppState>();
            let buf_reader = BufReader::new(reader);
            for line in buf_reader.lines() {
                if let Ok(line) = line {
                    let entry = LogEntry {
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        stream: "stdout".to_string(),
                        line: line.clone(),
                    };
                    // Store in memory
                    {
                        let mut logs = state.worker_logs.lock().unwrap();
                        if let Some(entries) = logs.get_mut(&worker_id_reader) {
                            entries.push(entry.clone());
                        }
                    }
                    // Emit to frontend
                    if let Err(e) = app_reader.emit("worker-log", (&worker_id_reader, &entry)) {
                        eprintln!("Failed to emit worker-log: {}", e);
                    }
                }
            }
        })
        .unwrap_or_else(|e| {
            eprintln!("Failed to spawn PTY reader thread: {}", e);
            panic!("Cannot read worker PTY");
        });

    // Spawn a thread to wait for process exit and update status
    let app_wait = app.clone();
    let worker_id_wait = worker_id.clone();
    thread::Builder::new()
        .name(format!("worker-{}-wait", &worker_id_wait[..8]))
        .spawn(move || {
            let exit_status = child.wait();
            let (final_status, exit_code) = match exit_status {
                Ok(status) => {
                    let code = status.exit_code() as i32;
                    if code == 0 {
                        (WorkerStatusEnum::Completed, Some(code))
                    } else {
                        (WorkerStatusEnum::Failed, Some(code))
                    }
                }
                Err(_) => (WorkerStatusEnum::Failed, None),
            };

            let state = app_wait.state::<AppState>();

            if final_status == WorkerStatusEnum::Failed {
                let failure_line = match exit_code {
                    Some(code) => format!("Process exited with non-zero code: {}", code),
                    None => "Process terminated unexpectedly (no exit code)".to_string(),
                };
                let failure_entry = LogEntry {
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    stream: "stderr".to_string(),
                    line: failure_line,
                };

                {
                    let mut logs = state.worker_logs.lock().unwrap();
                    if let Some(entries) = logs.get_mut(&worker_id_wait) {
                        entries.push(failure_entry.clone());
                    }
                }

                if let Err(e) = app_wait.emit("worker-log", (&worker_id_wait, &failure_entry)) {
                    eprintln!("Failed to emit worker-log failure entry: {}", e);
                }
            }

            // Update Worker record
            {
                let mut workers = state.workers.lock().unwrap();
                if let Some(w) = workers.iter_mut().find(|w| w.id == worker_id_wait) {
                    w.status = final_status.clone();
                    w.stopped_at = Some(chrono::Utc::now().to_rfc3339());
                }
                state.save_workers(&workers);
            }

            // Find the crew path for diff stats
            let crew_path = {
                let runs = state.runs.lock().unwrap();
                let crew_id = runs
                    .iter()
                    .find(|r| r.worker_id == worker_id_wait)
                    .map(|r| r.crew_id.clone());
                drop(runs);

                crew_id.and_then(|cid| {
                    let crews = state.crews.lock().unwrap();
                    crews.iter().find(|c| c.id == cid).map(|c| c.path.clone())
                })
            };

            // Collect diff stats
            let diff_stats = crew_path.and_then(|path| {
                crate::git::get_diff_stat(&path).ok()
            });

            // Update Run record
            {
                let run_status = match final_status {
                    WorkerStatusEnum::Completed => RunStatus::Completed,
                    _ => RunStatus::Failed,
                };
                let mut runs = state.runs.lock().unwrap();
                if let Some(run) = runs.iter_mut().find(|r| r.worker_id == worker_id_wait) {
                    run.status = run_status;
                    run.finished_at = Some(chrono::Utc::now().to_rfc3339());
                    run.exit_code = exit_code;
                    run.diff_stats = diff_stats;
                }
                state.save_runs(&runs);
            }

            // Flush logs from memory to disk
            {
                let mut logs = state.worker_logs.lock().unwrap();
                if let Some(entries) = logs.remove(&worker_id_wait) {
                    state.save_log(&worker_id_wait, &entries);
                }
            }

            // Emit status event to frontend
            if let Err(e) = app_wait.emit(
                "worker-status",
                (&worker_id_wait, format!("{:?}", final_status)),
            ) {
                eprintln!("Failed to emit worker-status: {}", e);
            }
        })
        .unwrap_or_else(|e| {
            eprintln!("Failed to spawn wait thread: {}", e);
            panic!("Cannot wait on worker process");
        });

    Ok(worker.clone())
}

// ── Tauri commands ──

#[tauri::command]
pub fn spawn_worker(
    crew_id: String,
    agent_type: String,
    initial_prompt: String,
    app: AppHandle,
) -> Result<Worker, String> {
    spawn_worker_inner(crew_id, agent_type, initial_prompt, app)
}

#[tauri::command]
pub fn stop_worker(id: String, state: State<AppState>) -> Result<(), String> {
    let mut workers = state.workers.lock().unwrap();
    let worker = workers
        .iter_mut()
        .find(|w| w.id == id)
        .ok_or_else(|| "Worker not found".to_string())?;

    if let Some(pid) = worker.pid {
        kill_process_tree(pid);
    }

    worker.status = WorkerStatusEnum::Stopped;
    worker.stopped_at = Some(chrono::Utc::now().to_rfc3339());
    state.save_workers(&workers);

    Ok(())
}

#[tauri::command]
pub fn delete_worker(id: String, state: State<AppState>) -> Result<(), String> {
    let mut workers = state.workers.lock().unwrap();
    let idx = workers
        .iter()
        .position(|w| w.id == id)
        .ok_or_else(|| "Worker not found".to_string())?;

    let worker = &workers[idx];

    // If still running, kill it first
    if worker.status == WorkerStatusEnum::Running {
        if let Some(pid) = worker.pid {
            kill_process_tree(pid);
        }
    }

    workers.remove(idx);
    state.save_workers(&workers);
    drop(workers);

    // Also remove in-memory logs
    {
        let mut logs = state.worker_logs.lock().unwrap();
        logs.remove(&id);
    }

    // Delete log file from disk
    state.delete_log(&id);

    Ok(())
}

#[tauri::command]
pub fn get_worker_status(id: String, state: State<AppState>) -> Result<Worker, String> {
    let workers = state.workers.lock().unwrap();
    workers
        .iter()
        .find(|w| w.id == id)
        .cloned()
        .ok_or_else(|| "Worker not found".to_string())
}

#[tauri::command]
pub fn list_workers(rig_id: String, state: State<AppState>) -> Vec<Worker> {
    let workers = state.workers.lock().unwrap();
    workers
        .iter()
        .filter(|w| w.rig_id == rig_id)
        .cloned()
        .collect()
}

#[tauri::command]
pub fn get_worker_logs(id: String, state: State<AppState>) -> Vec<LogEntry> {
    // First check in-memory logs
    let logs = state.worker_logs.lock().unwrap();
    if let Some(entries) = logs.get(&id) {
        return entries.clone();
    }
    drop(logs);

    // Fall back to disk
    state.load_log(&id)
}

// ── Run/Execute commands ──

#[tauri::command]
pub fn execute_task(
    task_id: String,
    crew_id: String,
    agent_type: String,
    template_name: String,
    state: State<AppState>,
    app: AppHandle,
) -> Result<Run, String> {
    // Get task
    let tasks = state.tasks.lock().unwrap();
    let task = tasks
        .iter()
        .find(|t| t.id == task_id)
        .ok_or_else(|| "Task not found".to_string())?;
    let task_title = task.title.clone();
    let task_description = task.description.clone();
    drop(tasks);

    // Get crew
    let crews = state.crews.lock().unwrap();
    let crew = crews
        .iter()
        .find(|c| c.id == crew_id)
        .ok_or_else(|| "Crew not found".to_string())?;
    let crew_branch = crew.branch.clone();
    let rig_id = crew.rig_id.clone();
    drop(crews);

    // Get rig
    let rigs = state.rigs.lock().unwrap();
    let rig = rigs
        .iter()
        .find(|r| r.id == rig_id)
        .ok_or_else(|| "Rig not found".to_string())?;
    let rig_name = rig.name.clone();
    let rig_path = rig.path.clone();
    drop(rigs);

    // Render prompt template
    let rendered = crate::templates::render_builtin_template(
        &template_name,
        &task_title,
        &task_description,
        &rig_name,
        &crew_branch,
        &rig_path,
    );

    // Spawn the worker via inner function (no State<> dependency)
    let worker = spawn_worker_inner(crew_id.clone(), agent_type.clone(), rendered.clone(), app)?;

    // Create run record
    let run = Run::new(
        task_id,
        worker.id.clone(),
        crew_id,
        rig_id,
        agent_type,
        template_name,
        rendered,
    );

    let mut runs = state.runs.lock().unwrap();
    runs.push(run.clone());
    state.save_runs(&runs);

    Ok(run)
}

#[tauri::command]
pub fn list_runs(rig_id: String, state: State<AppState>) -> Vec<Run> {
    let runs = state.runs.lock().unwrap();
    runs.iter().filter(|r| r.rig_id == rig_id).cloned().collect()
}

#[tauri::command]
pub fn get_run(id: String, state: State<AppState>) -> Result<Run, String> {
    let runs = state.runs.lock().unwrap();
    runs.iter()
        .find(|r| r.id == id)
        .cloned()
        .ok_or_else(|| "Run not found".to_string())
}

#[tauri::command]
pub fn get_run_logs(id: String, state: State<AppState>) -> Result<Vec<LogEntry>, String> {
    // Find the run to get its worker_id
    let runs = state.runs.lock().unwrap();
    let run = runs
        .iter()
        .find(|r| r.id == id)
        .ok_or_else(|| "Run not found".to_string())?;
    let worker_id = run.worker_id.clone();
    drop(runs);

    // Get logs for the worker
    let logs = state.worker_logs.lock().unwrap();
    if let Some(entries) = logs.get(&worker_id) {
        return Ok(entries.clone());
    }
    drop(logs);

    Ok(state.load_log(&worker_id))
}

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(target_os = "linux")]
    let program = "xdg-open";
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let program = "xdg-open";

    Command::new(program)
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open file manager: {}", e))?;
    Ok(())
}
