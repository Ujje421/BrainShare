/**
 * Typed wrappers around Tauri invoke() commands.
 *
 * Each function corresponds to a #[tauri::command] in src-tauri/src/commands.rs.
 * This module is the ONLY place that calls invoke() so the rest of the frontend
 * stays decoupled from Tauri internals.
 */
import { invoke } from "@tauri-apps/api/core";
import type { Project, AgentType } from "./store";

// ── Project CRUD ──────────────────────────────────────────

export interface CreateProjectArgs {
  name: string;
  repoPath: string;
  agentType: AgentType;
}

export async function listProjects(): Promise<Project[]> {
  return invoke<Project[]>("list_projects");
}

export async function createProject(args: CreateProjectArgs): Promise<Project> {
  return invoke<Project>("create_project", { 
    name: args.name, 
    repoPath: args.repoPath, 
    agentType: args.agentType 
  });
}

export async function deleteProject(id: string): Promise<void> {
  return invoke<void>("delete_project", { id });
}

export async function getProject(id: string): Promise<Project> {
  return invoke<Project>("get_project", { id });
}

// ── Memory ────────────────────────────────────────────────

export async function readMemoryFile(
  projectId: string,
  fileName: string
): Promise<string> {
  return invoke<string>("read_memory_file", { projectId, fileName });
}

export async function writeMemoryFile(
  projectId: string,
  fileName: string,
  content: string
): Promise<void> {
  return invoke<void>("write_memory_file", { projectId, fileName, content });
}

export async function listMemoryFiles(projectId: string): Promise<string[]> {
  return invoke<string[]>("list_memory_files", { projectId });
}
