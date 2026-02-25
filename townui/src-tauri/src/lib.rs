pub mod commands;
pub mod git;
pub mod models;
pub mod state;
pub mod templates;

use models::worker::WorkerStatusEnum;
use state::AppState;
use tauri::{Manager, RunEvent};
use std::process::{Command, Stdio};

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

fn auto_start_ai_inbox_bridge(app_handle: &tauri::AppHandle) {
    let state = app_handle.state::<AppState>();
    let bridge_settings = {
        let settings = state.settings.lock().unwrap_or_else(|e| e.into_inner());
        settings.ai_inbox_bridge.clone()
    };

    if !bridge_settings.auto_start {
        return;
    }

    let mut cmd = Command::new("ai-inbox-bridge");
    cmd.arg("--bind-addr").arg(bridge_settings.bind_addr);
    if !bridge_settings.token.trim().is_empty() {
        cmd.arg("--token").arg(bridge_settings.token);
    }
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    match cmd.spawn() {
        Ok(child) => {
            if let Ok(mut pid_slot) = state.ai_inbox_bridge_pid.lock() {
                *pid_slot = Some(child.id());
            }
            eprintln!("[startup] AI Inbox Bridge started (pid {})", child.id());
        }
        Err(err) => {
            eprintln!("[startup] Failed to start AI Inbox Bridge: {}", err);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            auto_start_ai_inbox_bridge(app.handle());
            Ok(())
        })
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
            commands::crews::create_cross_rig_worktree,
            // Tasks
            commands::tasks::list_tasks,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::ai_inbox::get_ai_inbox_status,
            commands::ai_inbox::start_ai_inbox,
            commands::ai_inbox::stop_ai_inbox,
            commands::ai_inbox::ingest_ai_brief,
            // Hooks
            commands::hooks::list_hooks,
            commands::hooks::create_hook,
            commands::hooks::delete_hook,
            commands::hooks::assign_to_hook,
            commands::hooks::sling,
            commands::hooks::done,
            commands::hooks::resume_hook,
            commands::hooks::get_rig_queue,
            // Refinery (per-rig merge queue/integration)
            commands::refinery::get_refinery_queue,
            commands::refinery::sync_rig_refinery,
            // Handoffs
            commands::handoffs::list_handoffs,
            commands::handoffs::create_handoff,
            commands::handoffs::accept_handoff,
            commands::handoffs::reject_handoff,
            commands::handoffs::export_handoff,
            commands::handoffs::import_handoff,
            // Convoys
            commands::convoys::list_convoys,
            commands::convoys::get_convoy,
            commands::convoys::create_convoy,
            commands::convoys::create_convoy_v2,
            commands::convoys::add_item_to_convoy,
            commands::convoys::update_convoy_status,
            commands::convoys::convoy_land,
            // Actors
            commands::actors::list_actors,
            commands::actors::create_actor,
            commands::actors::get_actor,
            commands::actors::delete_actor,
            commands::actors::get_actor_health,
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
            commands::workers::write_line_to_worker,
            commands::workers::resize_worker_pty,
            commands::workers::spawn_polecat,
            commands::workers::set_run_model_tag,
            commands::workers::set_run_quality_signal,
            commands::workers::list_run_stats,
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
            // Supervisor (Gas Town runtime actions)
            commands::supervisor::get_supervisor_status,
            commands::supervisor::start_supervisor,
            commands::supervisor::stop_supervisor,
            commands::supervisor::reconcile_queue,
            commands::supervisor::compact_state,
            // Operations aliases (Gas Town style)
            commands::operations::town_install,
            commands::operations::town_up,
            commands::operations::town_down,
            commands::operations::town_shutdown,
            commands::operations::town_status,
            commands::operations::get_roles_status,
            commands::operations::set_roles_status,
            commands::operations::mayor_plan_objective,
            commands::operations::deacon_patrol,
            commands::operations::witness_report,
            commands::operations::town_doctor,
            commands::operations::town_fix,
            // Workflows
            commands::workflows::list_workflow_templates,
            commands::workflows::get_workflow_template,
            commands::workflows::create_workflow_template,
            commands::workflows::delete_workflow_template,
            commands::workflows::list_workflow_instances,
            commands::workflows::get_workflow_instance,
            commands::workflows::delete_workflow_instance,
            commands::workflows::instantiate_workflow,
            commands::workflows::cook_formula,
            commands::workflows::pour_protomolecule,
            commands::workflows::create_wisp_preview,
            commands::workflows::start_workflow,
            commands::workflows::get_ready_steps,
            commands::workflows::advance_step,
            commands::workflows::cancel_workflow,
            // Dog pool
            commands::dogs::list_dogs,
            commands::dogs::get_dog_pool_status,
            commands::dogs::spawn_dog,
            commands::dogs::prune_dogs,
            // Seed
            commands::seed::seed_workflow_templates,
            commands::seed::seed_gastown_formulas,
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

            let bridge_pid_to_kill = {
                if let Ok(mut bridge_pid) = state.ai_inbox_bridge_pid.lock() {
                    let pid = *bridge_pid;
                    *bridge_pid = None;
                    pid
                } else {
                    None
                }
            };
            if let Some(pid) = bridge_pid_to_kill {
                eprintln!("[shutdown] Killing AI Inbox Bridge (pid {})", pid);
                kill_pid(pid);
            }
        }
    });
}
