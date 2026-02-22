pub mod commands;
pub mod git;
pub mod models;
pub mod state;
pub mod templates;

use models::worker::WorkerStatusEnum;
use state::AppState;
use tauri::{Manager, RunEvent};

/// Kill a process tree by PID (used during shutdown cleanup).
fn kill_pid(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Rigs
            commands::rigs::list_rigs,
            commands::rigs::create_rig,
            commands::rigs::get_rig,
            commands::rigs::delete_rig,
            // Crews
            commands::crews::list_crews,
            commands::crews::create_crew,
            commands::crews::get_crew,
            commands::crews::delete_crew,
            commands::crews::list_branches,
            commands::crews::get_crew_presets,
            // Tasks
            commands::tasks::list_tasks,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            // Hooks
            commands::hooks::list_hooks,
            commands::hooks::create_hook,
            commands::hooks::assign_to_hook,
            commands::hooks::sling,
            commands::hooks::done,
            commands::hooks::resume_hook,
            // Handoffs
            commands::handoffs::list_handoffs,
            commands::handoffs::create_handoff,
            commands::handoffs::accept_handoff,
            // Convoys
            commands::convoys::list_convoys,
            commands::convoys::get_convoy,
            commands::convoys::create_convoy,
            commands::convoys::add_item_to_convoy,
            commands::convoys::update_convoy_status,
            // Actors
            commands::actors::list_actors,
            commands::actors::create_actor,
            commands::actors::get_actor,
            commands::actors::delete_actor,
            // Workers & Runs
            commands::workers::spawn_worker,
            commands::workers::stop_worker,
            commands::workers::delete_worker,
            commands::workers::get_worker_status,
            commands::workers::list_workers,
            commands::workers::get_worker_logs,
            commands::workers::execute_task,
            commands::workers::list_runs,
            commands::workers::get_run,
            commands::workers::get_run_logs,
            commands::workers::open_in_explorer,
            commands::workers::write_to_worker,
            commands::workers::resize_worker_pty,
            // Templates
            commands::templates::list_templates,
            commands::templates::render_template,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::validate_cli_path,
            // Audit
            commands::audit::list_audit_events,
            commands::audit::get_task_audit_events,
            // Health
            commands::tasks::get_health_metrics,
            commands::tasks::escalate_stuck_tasks,
            // Workflows
            commands::workflows::list_workflow_templates,
            commands::workflows::get_workflow_template,
            commands::workflows::create_workflow_template,
            commands::workflows::delete_workflow_template,
            commands::workflows::list_workflow_instances,
            commands::workflows::get_workflow_instance,
            commands::workflows::instantiate_workflow,
            commands::workflows::start_workflow,
            commands::workflows::get_ready_steps,
            commands::workflows::advance_step,
            commands::workflows::cancel_workflow,
            // Seed
            commands::seed::seed_workflow_templates,
            commands::seed::get_seed_info,
            commands::terminal::run_rig_command,
        ])
        .build(tauri::generate_context!())
        .expect("error while building TownUI");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } = &event {
            // Kill all running worker processes on app exit
            let state = app_handle.state::<AppState>();
            if let Ok(workers) = state.workers.lock() {
                for worker in workers.iter() {
                    if worker.status == WorkerStatusEnum::Running {
                        if let Some(pid) = worker.pid {
                            eprintln!("[shutdown] Killing worker {} (pid {})", worker.id, pid);
                            kill_pid(pid);
                        }
                    }
                }
            }

            // Flush any in-memory logs to disk
            let drained_logs = {
                if let Ok(mut logs) = state.worker_logs.lock() {
                    logs.drain().collect::<Vec<(String, Vec<_>)>>()
                } else {
                    Vec::new()
                }
            };
            for (worker_id, entries) in drained_logs {
                state.save_log(&worker_id, &entries);
            }
        }
    });
}
