use tauri::State;

use crate::models::task::{Task, TaskPriority, TaskUpdateRequest};
use crate::state::AppState;

#[tauri::command]
pub fn list_tasks(rig_id: String, state: State<AppState>) -> Vec<Task> {
    let tasks = state.tasks.lock().unwrap();
    tasks.iter().filter(|t| t.rig_id == rig_id).cloned().collect()
}

#[tauri::command]
pub fn create_task(
    rig_id: String,
    title: String,
    description: String,
    tags: Vec<String>,
    priority: TaskPriority,
    state: State<AppState>,
) -> Task {
    let task = Task::new(rig_id, title, description, tags, priority);
    let mut tasks = state.tasks.lock().unwrap();
    tasks.push(task.clone());
    state.save_tasks(&tasks);
    task
}

#[tauri::command]
pub fn update_task(
    id: String,
    updates: TaskUpdateRequest,
    state: State<AppState>,
) -> Result<Task, String> {
    let mut tasks = state.tasks.lock().unwrap();
    let task = tasks
        .iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| "Task not found".to_string())?;

    task.apply_update(updates);
    let updated = task.clone();
    state.save_tasks(&tasks);
    Ok(updated)
}

#[tauri::command]
pub fn delete_task(id: String, state: State<AppState>) -> Result<(), String> {
    let mut tasks = state.tasks.lock().unwrap();
    let len_before = tasks.len();
    tasks.retain(|t| t.id != id);
    if tasks.len() == len_before {
        return Err("Task not found".to_string());
    }
    state.save_tasks(&tasks);
    Ok(())
}
