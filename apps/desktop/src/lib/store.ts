import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────

export type AgentType = "claude" | "codex" | "aider" | "cursor" | "custom";

export interface Project {
  id: string;
  name: string;
  repoPath: string;
  agentType: AgentType;
  createdAt: string;
}

export type ActiveTab = "terminal" | "memory" | "share";

interface AppState {
  // Projects
  projects: Project[];
  selectedProjectId: string | null;
  setProjects: (projects: Project[]) => void;
  selectProject: (id: string | null) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;

  // UI
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  showNewProjectModal: boolean;
  setShowNewProjectModal: (show: boolean) => void;
  showSettingsDialog: boolean;
  setShowSettingsDialog: (show: boolean) => void;
}

// ── Store ─────────────────────────────────────────────────

export const useStore = create<AppState>()((set) => ({
  // Projects
  projects: [],
  selectedProjectId: null,
  setProjects: (projects) => set({ projects }),
  selectProject: (id) => set({ selectedProjectId: id }),
  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
      selectedProjectId: project.id,
    })),
  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProjectId:
        state.selectedProjectId === id ? null : state.selectedProjectId,
    })),

  // UI
  activeTab: "terminal",
  setActiveTab: (tab) => set({ activeTab: tab }),
  showNewProjectModal: false,
  setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
  showSettingsDialog: false,
  setShowSettingsDialog: (show) => set({ showSettingsDialog: show }),
}));
