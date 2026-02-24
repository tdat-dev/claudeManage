use serde::Serialize;
use tauri::State;

use crate::models::actor::Actor;
use crate::models::task::TaskStatus;
use crate::models::worker::WorkerStatusEnum;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct ActorHealth {
    pub actor_id: String,
    pub rig_id: String,
    pub tasks_total: usize,
    pub tasks_in_progress: usize,
    pub tasks_blocked: usize,
    pub hook_status: Option<String>,
    pub last_heartbeat: Option<String>,
    pub has_running_worker: bool,
}

#[tauri::command]
pub fn list_actors(rig_id: String, state: State<AppState>) -> Vec<Actor> {
    let actors = state.actors.lock().unwrap();
    actors.iter().filter(|a| a.rig_id == rig_id).cloned().collect()
}

#[tauri::command]
pub fn create_actor(
    name: String,
    role: String,
    agent_type: String,
    rig_id: String,
    state: State<AppState>,
) -> Result<Actor, String> {
    // Verify rig exists
    {
        let rigs = state.rigs.lock().unwrap();
        if !rigs.iter().any(|r| r.id == rig_id) {
            return Err("Rig not found".to_string());
        }
    }

    let actor = Actor::new(name, role, agent_type, rig_id);
    let mut actors = state.actors.lock().unwrap();
    actors.push(actor.clone());
    state.save_actors(&actors);

    Ok(actor)
}

#[tauri::command]
pub fn get_actor(actor_id: String, state: State<AppState>) -> Result<Actor, String> {
    let actors = state.actors.lock().unwrap();
    actors
        .iter()
        .find(|a| a.actor_id == actor_id)
        .cloned()
        .ok_or_else(|| "Actor not found".to_string())
}

#[tauri::command]
pub fn delete_actor(actor_id: String, state: State<AppState>) -> Result<(), String> {
    let mut actors = state.actors.lock().unwrap();
    let idx = actors
        .iter()
        .position(|a| a.actor_id == actor_id)
        .ok_or_else(|| "Actor not found".to_string())?;
    actors.remove(idx);
    state.save_actors(&actors);
    Ok(())
}

#[tauri::command]
pub fn get_actor_health(actor_id: String, state: State<AppState>) -> Result<ActorHealth, String> {
    let actor = {
        let actors = state.actors.lock().unwrap();
        actors
            .iter()
            .find(|a| a.actor_id == actor_id)
            .cloned()
            .ok_or_else(|| "Actor not found".to_string())?
    };

    let tasks = state.tasks.lock().unwrap();
    let actor_tasks: Vec<_> = tasks
        .iter()
        .filter(|t| t.rig_id == actor.rig_id && t.owner_actor_id.as_deref() == Some(actor.actor_id.as_str()))
        .collect();

    let tasks_total = actor_tasks.len();
    let tasks_in_progress = actor_tasks
        .iter()
        .filter(|t| t.status == TaskStatus::InProgress)
        .count();
    let tasks_blocked = actor_tasks
        .iter()
        .filter(|t| t.status == TaskStatus::Blocked || t.status == TaskStatus::Escalated)
        .count();
    drop(tasks);

    let (hook_status, last_heartbeat) = {
        let hooks = state.hooks.lock().unwrap();
        hooks
            .iter()
            .find(|h| h.rig_id == actor.rig_id && h.attached_actor_id == actor.actor_id)
            .map(|h| (Some(format!("{:?}", h.status).to_lowercase()), Some(h.last_heartbeat.clone())))
            .unwrap_or((None, None))
    };

    let has_running_worker = {
        let workers = state.workers.lock().unwrap();
        workers.iter().any(|w| {
            w.rig_id == actor.rig_id
                && w.actor_id.as_deref() == Some(actor.actor_id.as_str())
                && w.status == WorkerStatusEnum::Running
        })
    };

    Ok(ActorHealth {
        actor_id: actor.actor_id,
        rig_id: actor.rig_id,
        tasks_total,
        tasks_in_progress,
        tasks_blocked,
        hook_status,
        last_heartbeat,
        has_running_worker,
    })
}
