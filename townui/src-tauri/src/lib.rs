pub mod commands;
pub mod git;
pub mod models;
pub mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::rigs::list_rigs,
            commands::rigs::create_rig,
            commands::rigs::get_rig,
            commands::rigs::delete_rig,
            commands::terminal::run_rig_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TownUI");
}
