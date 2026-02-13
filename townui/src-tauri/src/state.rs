use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

/// A thread-safe writer handle for sending input to a running worker's stdin/PTY.
pub type WorkerWriter = Box<dyn Write + Send>;

/// A handle to the PTY master, kept alive so the PTY stays open and can be resized.
pub type PtyMasterHandle = Box<dyn portable_pty::MasterPty + Send>;

use crate::models::actor::Actor;
use crate::models::audit::AuditEvent;
use crate::models::convoy::Convoy;
use crate::models::crew::Crew;
use crate::models::handoff::Handoff;
use crate::models::hook::Hook;
use crate::models::rig::Rig;
use crate::models::settings::AppSettings;
use crate::models::task::Task;
use crate::models::worker::{LogEntry, Run, Worker};

pub struct AppState {
    pub rigs: Mutex<Vec<Rig>>,
    pub crews: Mutex<Vec<Crew>>,
    pub tasks: Mutex<Vec<Task>>,
    pub hooks: Mutex<Vec<Hook>>,
    pub handoffs: Mutex<Vec<Handoff>>,
    pub convoys: Mutex<Vec<Convoy>>,
    pub actors: Mutex<Vec<Actor>>,
    pub workers: Mutex<Vec<Worker>>,
    pub runs: Mutex<Vec<Run>>,
    pub worker_logs: Mutex<HashMap<String, Vec<LogEntry>>>,
    pub worker_writers: Mutex<HashMap<String, WorkerWriter>>,
    pub worker_pty_masters: Mutex<HashMap<String, PtyMasterHandle>>,
    pub settings: Mutex<AppSettings>,
    pub town_dir: PathBuf,
}

impl AppState {
    pub fn new() -> Self {
        let town_dir = dirs::home_dir()
            .expect("Could not find home directory")
            .join(".townui");

        fs::create_dir_all(&town_dir).expect("Could not create .townui directory");
        fs::create_dir_all(town_dir.join("worktrees")).ok();
        fs::create_dir_all(town_dir.join("logs")).ok();
        fs::create_dir_all(town_dir.join("templates")).ok();

        let rigs: Vec<Rig> = Self::load_json_vec(&town_dir, "rigs.json");
        let crews: Vec<Crew> = Self::load_json_vec(&town_dir, "crews.json");
        let tasks: Vec<Task> = Self::load_json_vec(&town_dir, "tasks.json");
        let hooks: Vec<Hook> = Self::load_json_vec(&town_dir, "hooks.json");
        let handoffs: Vec<Handoff> = Self::load_json_vec(&town_dir, "handoffs.json");
        let convoys: Vec<Convoy> = Self::load_json_vec(&town_dir, "convoys.json");
        let actors: Vec<Actor> = Self::load_json_vec(&town_dir, "actors.json");
        let workers: Vec<Worker> = Self::load_json_vec(&town_dir, "workers.json");
        let runs: Vec<Run> = Self::load_json_vec(&town_dir, "runs.json");

        let settings: AppSettings = Self::load_json_obj(&town_dir, "settings.json");

        Self {
            rigs: Mutex::new(rigs),
            crews: Mutex::new(crews),
            tasks: Mutex::new(tasks),
            hooks: Mutex::new(hooks),
            handoffs: Mutex::new(handoffs),
            convoys: Mutex::new(convoys),
            actors: Mutex::new(actors),
            workers: Mutex::new(workers),
            runs: Mutex::new(runs),
            worker_logs: Mutex::new(HashMap::new()),
            worker_writers: Mutex::new(HashMap::new()),
            worker_pty_masters: Mutex::new(HashMap::new()),
            settings: Mutex::new(settings),
            town_dir,
        }
    }

    fn load_json_vec<T: serde::de::DeserializeOwned>(town_dir: &PathBuf, filename: &str) -> Vec<T> {
        let path = town_dir.join(filename);
        if path.exists() {
            let data = fs::read_to_string(&path).unwrap_or_else(|_| "[]".to_string());
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    fn load_json_obj<T: serde::de::DeserializeOwned + Default>(town_dir: &PathBuf, filename: &str) -> T {
        let path = town_dir.join(filename);
        if path.exists() {
            let data = fs::read_to_string(&path).unwrap_or_else(|_| "{}".to_string());
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            T::default()
        }
    }

    fn save_json<T: serde::Serialize + ?Sized>(&self, data: &T, filename: &str) {
        let path = self.town_dir.join(filename);
        let json = serde_json::to_string_pretty(data).expect(&format!("Failed to serialize {}", filename));
        fs::write(path, json).expect(&format!("Failed to write {}", filename));
    }

    pub fn save_rigs(&self, rigs: &[Rig]) {
        self.save_json(rigs, "rigs.json");
    }

    pub fn save_crews(&self, crews: &[Crew]) {
        self.save_json(crews, "crews.json");
    }

    pub fn save_tasks(&self, tasks: &[Task]) {
        self.save_json(tasks, "tasks.json");
    }

    pub fn save_hooks(&self, hooks: &[Hook]) {
        self.save_json(hooks, "hooks.json");
    }

    pub fn save_handoffs(&self, handoffs: &[Handoff]) {
        self.save_json(handoffs, "handoffs.json");
    }

    pub fn save_convoys(&self, convoys: &[Convoy]) {
        self.save_json(convoys, "convoys.json");
    }

    pub fn save_actors(&self, actors: &[Actor]) {
        self.save_json(actors, "actors.json");
    }

    pub fn save_workers(&self, workers: &[Worker]) {
        self.save_json(workers, "workers.json");
    }

    pub fn save_runs(&self, runs: &[Run]) {
        self.save_json(runs, "runs.json");
    }

    pub fn save_settings(&self, settings: &AppSettings) {
        self.save_json(settings, "settings.json");
    }

    pub fn worktrees_dir(&self) -> PathBuf {
        self.town_dir.join("worktrees")
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.town_dir.join("logs")
    }

    pub fn templates_dir(&self) -> PathBuf {
        self.town_dir.join("templates")
    }

    pub fn save_log(&self, worker_id: &str, entries: &[LogEntry]) {
        let log_path = self.logs_dir().join(format!("{}.jsonl", worker_id));
        let lines: Vec<String> = entries
            .iter()
            .map(|e| serde_json::to_string(e).unwrap_or_default())
            .collect();
        fs::write(log_path, lines.join("\n")).ok();
    }

    pub fn load_log(&self, worker_id: &str) -> Vec<LogEntry> {
        let log_path = self.logs_dir().join(format!("{}.jsonl", worker_id));
        if log_path.exists() {
            let data = fs::read_to_string(&log_path).unwrap_or_default();
            data.lines()
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn delete_log(&self, worker_id: &str) {
        let log_path = self.logs_dir().join(format!("{}.jsonl", worker_id));
        if log_path.exists() {
            fs::remove_file(log_path).ok();
        }
    }

    // ── Audit events (append-only) ──

    pub fn append_audit_event(&self, event: &AuditEvent) {
        let audit_path = self.town_dir.join("audit_events.jsonl");
        if let Ok(json) = serde_json::to_string(event) {
            if let Ok(mut file) = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&audit_path)
            {
                let _ = writeln!(file, "{}", json);
            }
        }
    }

    pub fn load_audit_events(&self, rig_id: Option<&str>, limit: usize) -> Vec<AuditEvent> {
        let audit_path = self.town_dir.join("audit_events.jsonl");
        if !audit_path.exists() {
            return Vec::new();
        }
        let data = fs::read_to_string(&audit_path).unwrap_or_default();
        let all: Vec<AuditEvent> = data
            .lines()
            .filter_map(|l| serde_json::from_str(l).ok())
            .collect();
        let filtered: Vec<AuditEvent> = match rig_id {
            Some(rid) => all.into_iter().filter(|e| e.rig_id == rid).collect(),
            None => all,
        };
        // Return most recent first, limited
        filtered.into_iter().rev().take(limit).collect()
    }

    pub fn load_audit_events_for_task(&self, task_id: &str) -> Vec<AuditEvent> {
        let audit_path = self.town_dir.join("audit_events.jsonl");
        if !audit_path.exists() {
            return Vec::new();
        }
        let data = fs::read_to_string(&audit_path).unwrap_or_default();
        data.lines()
            .filter_map(|l| serde_json::from_str::<AuditEvent>(l).ok())
            .filter(|e| e.work_item_id.as_deref() == Some(task_id))
            .collect()
    }
}
