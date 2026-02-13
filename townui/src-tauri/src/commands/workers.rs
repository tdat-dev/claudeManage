use std::io::{Read, Write};
use std::process::Command;
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::models::audit::{AuditEvent, AuditEventType};
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

/// Strip ANSI escape sequences from PTY output lines.
/// Handles CSI sequences (\x1b[...X), OSC sequences (\x1b]...BEL/ST), and simple two-char escapes.
fn strip_ansi_escapes(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            match chars.peek() {
                Some('[') => {
                    chars.next(); // consume '['
                    // consume until a letter (final byte of CSI: 0x40–0x7E)
                    while let Some(&ch) = chars.peek() {
                        chars.next();
                        if ch.is_ascii_alphabetic() || ch == '@' || ch == '~' {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next(); // consume ']'
                    // OSC: consume until BEL (\x07) or ST (\x1b\\)
                    while let Some(&ch) = chars.peek() {
                        chars.next();
                        if ch == '\x07' {
                            break;
                        }
                        if ch == '\x1b' {
                            if chars.peek() == Some(&'\\') {
                                chars.next();
                            }
                            break;
                        }
                    }
                }
                Some(_) => {
                    chars.next(); // consume one char after ESC
                }
                None => {}
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Prepare prompt text to be passed as a single shell argument.
/// PTY input is line-oriented, so embedded newlines would split the command.
fn sanitize_prompt_for_shell(prompt: &str) -> String {
    prompt
        .replace('\r', " ")
        .replace('\n', " ")
        .replace('"', "\\\"")
        .trim()
        .to_string()
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
    let has_custom_path = settings.cli_paths.contains_key(&agent_type);
    let cli_path = settings
        .cli_paths
        .get(&agent_type)
        .cloned()
        .unwrap_or_else(|| agent_type.clone());
    let env_vars = settings.env_vars.clone();
    drop(settings);

    // Validate CLI exists before trying to spawn
    #[cfg(target_os = "windows")]
    {
        if !has_custom_path {
            // For known agents, the binary name matches agent_type; verify it exists
            if resolve_windows_cli_path(&cli_path).is_none() {
                return Err(format!(
                    "Agent '{}' not found on this system. Install it or set its CLI path in Settings.",
                    agent_type
                ));
            }
        } else if resolve_windows_cli_path(&cli_path).is_none() {
            return Err(format!(
                "CLI path '{}' for agent '{}' not found. Check the path in Settings.",
                cli_path, agent_type
            ));
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if !has_custom_path {
            let check = Command::new("which").arg(&cli_path).output();
            if check.is_err() || !check.unwrap().status.success() {
                return Err(format!(
                    "Agent '{}' not found on this system. Install it or set its CLI path in Settings.",
                    agent_type
                ));
            }
        } else if !std::path::Path::new(&cli_path).exists() {
            let check = Command::new("which").arg(&cli_path).output();
            if check.is_err() || !check.unwrap().status.success() {
                return Err(format!(
                    "CLI path '{}' for agent '{}' not found. Check the path in Settings.",
                    cli_path, agent_type
                ));
            }
        }
    }


    // Build the full command string to send into the interactive shell
    let prompt_for_shell = sanitize_prompt_for_shell(&initial_prompt);
    let agent_command = match agent_type.as_str() {
        "claude" => format!("{} --print \"{}\"", cli_path, prompt_for_shell),
        "codex" => {
            if initial_prompt.is_empty() {
                cli_path.clone()
            } else {
                // Run one-shot task first, then keep the session inside Codex interactive CLI.
                format!(
                    "{} exec --full-auto -c model_reasoning_effort=low \"{}\" && {}",
                    cli_path, prompt_for_shell, cli_path
                )
            }
        }
        "chatgpt" | "gemini" | "mentat" | "gpt-engineer" | "continue"
        | "trae" | "pear" | "void" | "tabnine" | "supermaven"
        | "codestory" | "double" | "cursor" | "windsurf" | "bolt" => {
            if initial_prompt.is_empty() { cli_path.clone() }
            else { format!("{} --prompt \"{}\"", cli_path, prompt_for_shell) }
        }
        "copilot" => format!("{} copilot suggest \"{}\"", cli_path, prompt_for_shell),
        "amazon-q" => format!("{} chat \"{}\"", cli_path, prompt_for_shell),
        "aider" => format!("{} --message \"{}\" --yes-always --no-git", cli_path, prompt_for_shell),
        "goose" => format!("{} session --message \"{}\"", cli_path, prompt_for_shell),
        "openhands" | "swe-agent" => format!("{} run --task \"{}\"", cli_path, prompt_for_shell),
        "cline" | "augment" | "roo" => format!("{} --message \"{}\"", cli_path, prompt_for_shell),
        "tabby" | "cody" => format!("{} chat --message \"{}\"", cli_path, prompt_for_shell),
        "sweep" => format!("{} run \"{}\"", cli_path, prompt_for_shell),
        "auto-coder" => format!("{} --task \"{}\"", cli_path, prompt_for_shell),
        "devin" => format!("{} run --task \"{}\"", cli_path, prompt_for_shell),
        "replit" => format!("{} agent --task \"{}\"", cli_path, prompt_for_shell),
        _ => {
            if initial_prompt.is_empty() { cli_path.clone() }
            else { format!("{} \"{}\"", cli_path, prompt_for_shell) }
        }
    };

    // Spawn an interactive shell via PTY — the user gets a real terminal
    #[cfg(target_os = "windows")]
    let mut cmd = CommandBuilder::new("cmd");
    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        CommandBuilder::new(shell)
    };

    cmd.cwd(&cwd);

    // Add environment variables
    for (k, v) in &env_vars {
        cmd.env(k, v);
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

    let mut worker = Worker::new(rig_id.clone(), crew_id, agent_type.clone());
    worker.pid = pid;
    let worker_id = worker.id.clone();

    let mut workers = state.workers.lock().unwrap();
    workers.push(worker.clone());
    state.save_workers(&workers);
    drop(workers);

    // Audit: worker spawned
    state.append_audit_event(&AuditEvent::new(
        rig_id.clone(),
        None,
        None,
        AuditEventType::WorkerSpawned,
        serde_json::json!({
            "worker_id": worker_id,
            "agent_type": agent_type,
            "pid": pid,
        }).to_string(),
    ));

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

    // Get a writer from the PTY master (for sending input to the process)
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {}", e))?;

    // Store the writer so the frontend can send input to this worker
    {
        let mut writers = state.worker_writers.lock().unwrap();
        writers.insert(worker_id.clone(), writer);
    }

    // Send the agent command into the interactive shell
    {
        let mut writers = state.worker_writers.lock().unwrap();
        if let Some(w) = writers.get_mut(&worker_id) {
            let cmd_line = format!("{}\r\n", agent_command);
            let _ = w.write_all(cmd_line.as_bytes());
            let _ = w.flush();
        }
    }

    // Spawn a thread to read raw PTY output for real terminal rendering
    let app_reader = app.clone();
    let worker_id_reader = worker_id.clone();
    thread::Builder::new()
        .name(format!("worker-{}-pty", &worker_id_reader[..8]))
        .spawn(move || {
            let state = app_reader.state::<AppState>();
            let mut reader = reader;
            let mut buf = [0u8; 4096];
            let mut line_buf = String::new();

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();

                        // Emit raw data for xterm rendering
                        if let Err(e) = app_reader.emit("worker-pty-data", (&worker_id_reader, &data)) {
                            eprintln!("Failed to emit worker-pty-data: {}", e);
                        }

                        // Accumulate into lines for log storage
                        line_buf.push_str(&data);
                        while let Some(pos) = line_buf.find('\n') {
                            let raw_line = line_buf[..pos].trim_end_matches('\r').to_string();
                            let clean_line = strip_ansi_escapes(&raw_line);
                            if !clean_line.trim().is_empty() {
                                let entry = LogEntry {
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                    stream: "stdout".to_string(),
                                    line: clean_line,
                                };
                                {
                                    let mut logs = state.worker_logs.lock().unwrap();
                                    if let Some(entries) = logs.get_mut(&worker_id_reader) {
                                        entries.push(entry.clone());
                                    }
                                }
                                if let Err(e) = app_reader.emit("worker-log", (&worker_id_reader, &entry)) {
                                    eprintln!("Failed to emit worker-log: {}", e);
                                }
                            }
                            line_buf = line_buf[pos + 1..].to_string();
                        }
                    }
                    Err(_) => break,
                }
            }

            // Flush remaining partial line
            if !line_buf.trim().is_empty() {
                let clean = strip_ansi_escapes(&line_buf);
                if !clean.trim().is_empty() {
                    let entry = LogEntry {
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        stream: "stdout".to_string(),
                        line: clean,
                    };
                    let mut logs = state.worker_logs.lock().unwrap();
                    if let Some(entries) = logs.get_mut(&worker_id_reader) {
                        entries.push(entry);
                    }
                }
            }
        })
        .unwrap_or_else(|e| {
            eprintln!("Failed to spawn PTY reader thread: {}", e);
            panic!("Cannot read worker PTY");
        });

    // Store the PTY master in AppState so it stays alive and can be resized
    {
        let mut masters = state.worker_pty_masters.lock().unwrap();
        masters.insert(worker_id.clone(), pair.master);
    }

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

            // Remove writer and PTY master on exit
            {
                let mut writers = state.worker_writers.lock().unwrap();
                writers.remove(&worker_id_wait);
            }
            {
                let mut masters = state.worker_pty_masters.lock().unwrap();
                masters.remove(&worker_id_wait);
            }

            // Audit: worker completed/failed
            let audit_type = match final_status {
                WorkerStatusEnum::Completed => AuditEventType::WorkerCompleted,
                _ => AuditEventType::WorkerFailed,
            };
            let rig_id_for_audit = {
                let workers = state.workers.lock().unwrap();
                workers.iter().find(|w| w.id == worker_id_wait).map(|w| w.rig_id.clone()).unwrap_or_default()
            };
            state.append_audit_event(&AuditEvent::new(
                rig_id_for_audit,
                None,
                None,
                audit_type,
                serde_json::json!({
                    "worker_id": worker_id_wait,
                    "exit_code": exit_code,
                }).to_string(),
            ));

            // Emit status as snake_case to match frontend enum
            let status_str = match final_status {
                WorkerStatusEnum::Running => "running",
                WorkerStatusEnum::Stopped => "stopped",
                WorkerStatusEnum::Completed => "completed",
                WorkerStatusEnum::Failed => "failed",
            };
            if let Err(e) = app_wait.emit(
                "worker-status",
                (&worker_id_wait, status_str),
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
    let rig_id = worker.rig_id.clone();
    let worker_id = worker.id.clone();
    state.save_workers(&workers);
    drop(workers);

    // Remove writer and PTY master
    {
        let mut writers = state.worker_writers.lock().unwrap();
        writers.remove(&worker_id);
    }
    {
        let mut masters = state.worker_pty_masters.lock().unwrap();
        masters.remove(&worker_id);
    }

    // Audit: worker stopped
    state.append_audit_event(&AuditEvent::new(
        rig_id,
        None,
        None,
        AuditEventType::WorkerStopped,
        serde_json::json!({ "worker_id": worker_id }).to_string(),
    ));

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

    // Remove writer and PTY master
    {
        let mut writers = state.worker_writers.lock().unwrap();
        writers.remove(&id);
    }
    {
        let mut masters = state.worker_pty_masters.lock().unwrap();
        masters.remove(&id);
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

#[tauri::command]
pub fn resize_worker_pty(
    id: String,
    rows: u16,
    cols: u16,
    state: State<AppState>,
) -> Result<(), String> {
    let masters = state.worker_pty_masters.lock().unwrap();
    let master = masters
        .get(&id)
        .ok_or_else(|| "No active PTY for this worker".to_string())?;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("PTY resize failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn write_to_worker(id: String, input: String, state: State<AppState>) -> Result<(), String> {
    let mut writers = state.worker_writers.lock().unwrap();
    let writer = writers
        .get_mut(&id)
        .ok_or_else(|| "No active writer for this worker".to_string())?;
    writer
        .write_all(input.as_bytes())
        .map_err(|e| format!("Write failed: {}", e))?;
    writer
        .flush()
        .map_err(|e| format!("Flush failed: {}", e))?;
    Ok(())
}
