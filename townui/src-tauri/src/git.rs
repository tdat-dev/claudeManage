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

pub fn get_changed_file_count(path: &str) -> u32 {
    let output = Command::new("git")
        .args(["status", "--short"])
        .current_dir(path)
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { 0 } else { s.lines().count() as u32 }
        }
        _ => 0,
    }
}

pub fn list_branches(path: &str) -> Result<Vec<String>, String> {
    let output = Command::new("git")
        .args(["branch", "--format=%(refname:short)"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to run git branch: {}", e))?;

    if output.status.success() {
        let branches = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();
        Ok(branches)
    } else {
        Err(format!(
            "git branch failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[derive(Debug)]
pub struct WorktreeEntry {
    pub path: String,
    pub branch: String,
    pub is_bare: bool,
}

pub fn list_worktrees(repo_path: &str) -> Result<Vec<WorktreeEntry>, String> {
    let output = Command::new("git")
        .args(["worktree", "list", "--porcelain"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git worktree list: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "git worktree list failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut entries = Vec::new();
    let mut current_path = String::new();
    let mut current_branch = String::new();
    let mut is_bare = false;

    for line in text.lines() {
        if line.starts_with("worktree ") {
            if !current_path.is_empty() {
                entries.push(WorktreeEntry {
                    path: current_path.clone(),
                    branch: current_branch.clone(),
                    is_bare,
                });
            }
            current_path = line.strip_prefix("worktree ").unwrap_or("").to_string();
            current_branch = String::new();
            is_bare = false;
        } else if line.starts_with("branch ") {
            current_branch = line
                .strip_prefix("branch refs/heads/")
                .unwrap_or(line.strip_prefix("branch ").unwrap_or(""))
                .to_string();
        } else if line == "bare" {
            is_bare = true;
        } else if line.is_empty() && !current_path.is_empty() {
            entries.push(WorktreeEntry {
                path: current_path.clone(),
                branch: current_branch.clone(),
                is_bare,
            });
            current_path = String::new();
            current_branch = String::new();
            is_bare = false;
        }
    }
    // push last entry
    if !current_path.is_empty() {
        entries.push(WorktreeEntry {
            path: current_path,
            branch: current_branch,
            is_bare,
        });
    }

    Ok(entries)
}

pub fn create_worktree(
    repo_path: &str,
    worktree_path: &str,
    branch_name: &str,
    base_branch: &str,
) -> Result<(), String> {
    let output = Command::new("git")
        .args([
            "worktree",
            "add",
            worktree_path,
            "-b",
            branch_name,
            base_branch,
        ])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git worktree add: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "git worktree add failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

pub fn get_diff_stat(worktree_path: &str) -> Result<String, String> {
    // Try diff against previous commit first
    let output = Command::new("git")
        .args(["diff", "--stat", "HEAD~1..HEAD"])
        .current_dir(worktree_path)
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let stat = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !stat.is_empty() {
                return Ok(stat);
            }
        }
        _ => {}
    }

    // Fallback: diff of working tree
    let output = Command::new("git")
        .args(["diff", "--stat"])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| format!("Failed to run git diff --stat: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(format!(
            "git diff --stat failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

pub fn remove_worktree(repo_path: &str, worktree_path: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["worktree", "remove", worktree_path, "--force"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git worktree remove: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "git worktree remove failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

pub fn delete_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["branch", "-D", branch_name])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git branch -D: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "git branch -D failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

/// Push a local branch to origin so it is published on the remote.
pub fn push_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["push", "-u", "origin", branch_name])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "git push failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

/// Delete a branch from the remote (origin).
pub fn delete_remote_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["push", "origin", "--delete", branch_name])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git push --delete: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "git push --delete failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}
