use tauri::State;

use crate::models::actor::Actor;
use crate::state::AppState;

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
