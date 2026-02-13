pub mod commands;
pub mod git;
pub mod models;
pub mod state;
pub mod templates;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running TownUI");
}
