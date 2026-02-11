use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;

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

// ── Core spawn logic (no Tauri DI dependency) ──

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

    // Build the command
    let mut cmd = Command::new(&cli_path);
    cmd.current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Add environment variables
    for (k, v) in &env_vars {
        cmd.env(k, v);
    }

    // Agent-specific argument patterns
    match agent_type.as_str() {
        // ── Anthropic Claude Code ──
        "claude" => {
            cmd.args(["--print", &initial_prompt]);
        }
        // ── OpenAI Codex CLI ──
        "codex" => {
            cmd.args(["--quiet", &initial_prompt]);
        }
        // ── OpenAI ChatGPT CLI ──
        "chatgpt" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Google Gemini CLI ──
        "gemini" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── GitHub Copilot CLI ──
        "copilot" => {
            cmd.args(["copilot", "suggest", &initial_prompt]);
        }
        // ── Amazon Q Developer CLI ──
        "amazon-q" => {
            cmd.args(["chat", &initial_prompt]);
        }
        // ── Aider (open-source pair programmer) ──
        "aider" => {
            cmd.args(["--message", &initial_prompt, "--yes-always", "--no-git"]);
        }
        // ── Goose (Block open-source agent) ──
        "goose" => {
            cmd.args(["session", "--message", &initial_prompt]);
        }
        // ── OpenHands (formerly OpenDevin) ──
        "openhands" => {
            cmd.args(["run", "--task", &initial_prompt]);
        }
        // ── SWE-Agent (Princeton) ──
        "swe-agent" => {
            cmd.args(["run", "--task", &initial_prompt]);
        }
        // ── Mentat (ABI Labs) ──
        "mentat" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── GPT Engineer ──
        "gpt-engineer" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Cline CLI ──
        "cline" => {
            cmd.args(["--message", &initial_prompt]);
        }
        // ── Continue CLI ──
        "continue" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Tabby ──
        "tabby" => {
            cmd.args(["chat", &initial_prompt]);
        }
        // ── Roo Code ──
        "roo" => {
            cmd.args(["--message", &initial_prompt]);
        }
        // ── Sweep AI ──
        "sweep" => {
            cmd.args(["run", &initial_prompt]);
        }
        // ── Auto-Coder ──
        "auto-coder" => {
            cmd.args(["--task", &initial_prompt]);
        }
        // ── Cursor CLI ──
        "cursor" => {
            cmd.args(["--prompt", &initial_prompt]);
        }
        // ── Windsurf CLI ──
        "windsurf" => {
            cmd.args(["--prompt", &initial_prompt]);
        }
        // ── Trae (ByteDance) ──
        "trae" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Augment Code ──
        "augment" => {
            cmd.args(["--message", &initial_prompt]);
        }
        // ── PearAI ──
        "pear" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Void Editor ──
        "void" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Sourcegraph Cody ──
        "cody" => {
            cmd.args(["chat", "--message", &initial_prompt]);
        }
        // ── Tabnine ──
        "tabnine" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Supermaven ──
        "supermaven" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── CodeStory (Aide) ──
        "codestory" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Double ──
        "double" => {
            if !initial_prompt.is_empty() {
                cmd.args(["--prompt", &initial_prompt]);
            }
        }
        // ── Devin (Cognition) ──
        "devin" => {
            cmd.args(["run", "--task", &initial_prompt]);
        }
        // ── Replit Agent ──
        "replit" => {
            cmd.args(["agent", "--task", &initial_prompt]);
        }
        // ── Bolt.new ──
        "bolt" => {
            cmd.args(["--prompt", &initial_prompt]);
        }
        // ── Custom / unknown: pass prompt as argument ──
        _ => {
            if !initial_prompt.is_empty() {
                cmd.arg(&initial_prompt);
            }
        }
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", cli_path, e))?;

    let pid = child.id();

    let mut worker = Worker::new(rig_id, crew_id, agent_type);
    worker.pid = Some(pid);
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

    // Spawn a thread to read stdout
    let app_stdout = app.clone();
    let worker_id_stdout = worker_id.clone();
    let stdout = child.stdout.take();
    if let Some(stdout) = stdout {
        thread::Builder::new()
            .name(format!("worker-{}-stdout", &worker_id_stdout[..8]))
            .spawn(move || {
                let state = app_stdout.state::<AppState>();
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        let entry = LogEntry {
                            timestamp: chrono::Utc::now().to_rfc3339(),
                            stream: "stdout".to_string(),
                            line: line.clone(),
                        };
                        // Store in memory
                        {
                            let mut logs = state.worker_logs.lock().unwrap();
                            if let Some(entries) = logs.get_mut(&worker_id_stdout) {
                                entries.push(entry.clone());
                            }
                        }
                        // Emit to frontend
                        if let Err(e) = app_stdout.emit("worker-log", (&worker_id_stdout, &entry)) {
                            eprintln!("Failed to emit worker-log (stdout): {}", e);
                        }
                    }
                }
            })
            .unwrap_or_else(|e| {
                eprintln!("Failed to spawn stdout reader thread: {}", e);
                panic!("Cannot read worker stdout");
            });
    }

    // Spawn a thread to read stderr
    let app_stderr = app.clone();
    let worker_id_stderr = worker_id.clone();
    let stderr = child.stderr.take();
    if let Some(stderr) = stderr {
        thread::Builder::new()
            .name(format!("worker-{}-stderr", &worker_id_stderr[..8]))
            .spawn(move || {
                let state = app_stderr.state::<AppState>();
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        let entry = LogEntry {
                            timestamp: chrono::Utc::now().to_rfc3339(),
                            stream: "stderr".to_string(),
                            line: line.clone(),
                        };
                        // Store in memory
                        {
                            let mut logs = state.worker_logs.lock().unwrap();
                            if let Some(entries) = logs.get_mut(&worker_id_stderr) {
                                entries.push(entry.clone());
                            }
                        }
                        // Emit to frontend
                        if let Err(e) = app_stderr.emit("worker-log", (&worker_id_stderr, &entry)) {
                            eprintln!("Failed to emit worker-log (stderr): {}", e);
                        }
                    }
                }
            })
            .unwrap_or_else(|e| {
                eprintln!("Failed to spawn stderr reader thread: {}", e);
                panic!("Cannot read worker stderr");
            });
    }

    // Spawn a thread to wait for process exit and update status
    let app_wait = app.clone();
    let worker_id_wait = worker_id.clone();
    thread::Builder::new()
        .name(format!("worker-{}-wait", &worker_id_wait[..8]))
        .spawn(move || {
            let exit_status = child.wait();
            let (final_status, exit_code) = match exit_status {
                Ok(s) => {
                    if s.success() {
                        (WorkerStatusEnum::Completed, s.code())
                    } else {
                        (WorkerStatusEnum::Failed, s.code())
                    }
                }
                Err(_) => (WorkerStatusEnum::Failed, None),
            };

            let state = app_wait.state::<AppState>();

            // Update Worker record
            {
                let mut workers = state.workers.lock().unwrap();
                if let Some(w) = workers.iter_mut().find(|w| w.id == worker_id_wait) {
                    w.status = final_status.clone();
                    w.stopped_at = Some(chrono::Utc::now().to_rfc3339());
                }
                state.save_workers(&workers);
            }

            // Find the crew path for diff stats (lock crews separately, drop before locking runs)
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
