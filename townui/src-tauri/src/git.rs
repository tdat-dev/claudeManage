use std::path::Path;
use std::process::Command;

pub fn is_git_repo(path: &str) -> bool {
    Path::new(path).join(".git").exists()
}

pub fn get_current_branch(path: &str) -> Option<String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(path)
        .output()
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

pub fn get_short_status(path: &str) -> Option<String> {
    let output = Command::new("git")
        .args(["status", "--short"])
        .current_dir(path)
        .output()
        .ok()?;

    if output.status.success() {
        let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if status.is_empty() {
            Some("Clean".to_string())
        } else {
            let lines: Vec<&str> = status.lines().collect();
            Some(format!("{} changed file(s)", lines.len()))
        }
    } else {
        None
    }
}
