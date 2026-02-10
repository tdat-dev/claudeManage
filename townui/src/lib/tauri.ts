import { invoke } from "@tauri-apps/api/core";

export interface RigInfo {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_opened: string;
  git_branch: string | null;
  git_status: string | null;
  is_git_repo: boolean;
}

export async function listRigs(): Promise<RigInfo[]> {
  return invoke<RigInfo[]>("list_rigs");
}

export async function createRig(path: string): Promise<RigInfo> {
  return invoke<RigInfo>("create_rig", { path });
}

export async function getRig(id: string): Promise<RigInfo> {
  return invoke<RigInfo>("get_rig", { id });
}

export async function deleteRig(id: string): Promise<void> {
  return invoke<void>("delete_rig", { id });
}
