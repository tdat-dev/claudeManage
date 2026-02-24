use serde::{Deserialize, Serialize};

/// Dog roles — narrowly-scoped infrastructure helpers spawned by the Deacon.
/// Dogs are NOT project workers; they handle system-level tasks only.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DogRole {
    /// Triage Deacon health on daemon tick (equivalent to Gas Town's `boot` dog).
    Boot,
    /// Check worker heartbeats and mark crashed workers as failed.
    HealthCheck,
    /// Rotate / compress old log files that exceed size threshold.
    LogRotation,
    /// Detect orphan in-progress tasks (worker dead, task still `in_progress`).
    OrphanCleanup,
    /// Verify hook ↔ task consistency and repair mismatches.
    HookRepair,
}

impl std::fmt::Display for DogRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let label = match self {
            DogRole::Boot => "boot",
            DogRole::HealthCheck => "health-check",
            DogRole::LogRotation => "log-rotation",
            DogRole::OrphanCleanup => "orphan-cleanup",
            DogRole::HookRepair => "hook-repair",
        };
        write!(f, "{}", label)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DogStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dog {
    pub dog_id: String,
    pub role: DogRole,
    pub status: DogStatus,
    /// Which rig this dog is working on (None = global/town-level).
    pub rig_id: Option<String>,
    pub spawned_at: String,
    pub finished_at: Option<String>,
    /// Human-readable summary of what the dog did.
    pub result_summary: Option<String>,
}

impl Dog {
    pub fn new(role: DogRole, rig_id: Option<String>) -> Self {
        Self {
            dog_id: uuid::Uuid::new_v4().to_string(),
            role,
            status: DogStatus::Pending,
            rig_id,
            spawned_at: chrono::Utc::now().to_rfc3339(),
            finished_at: None,
            result_summary: None,
        }
    }
}
