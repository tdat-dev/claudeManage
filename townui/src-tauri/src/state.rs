use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::models::rig::Rig;

pub struct AppState {
    pub rigs: Mutex<Vec<Rig>>,
    pub town_dir: PathBuf,
}

impl AppState {
    pub fn new() -> Self {
        let town_dir = dirs::home_dir()
            .expect("Could not find home directory")
            .join(".townui");

        fs::create_dir_all(&town_dir).expect("Could not create .townui directory");

        let rigs_path = town_dir.join("rigs.json");
        let rigs: Vec<Rig> = if rigs_path.exists() {
            let data = fs::read_to_string(&rigs_path).unwrap_or_else(|_| "[]".to_string());
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Vec::new()
        };

        Self {
            rigs: Mutex::new(rigs),
            town_dir,
        }
    }

    pub fn save_rigs(&self, rigs: &[Rig]) {
        let rigs_path = self.town_dir.join("rigs.json");
        let data = serde_json::to_string_pretty(rigs).expect("Failed to serialize rigs");
        fs::write(rigs_path, data).expect("Failed to write rigs.json");
    }
}
