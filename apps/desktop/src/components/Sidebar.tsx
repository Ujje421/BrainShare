import { useState, useCallback } from "react";
import { useStore } from "../lib/store";
import { deleteProject } from "../lib/tauri";
import {
  Brain,
  Plus,
  FolderOpen,
  Trash2,
  Settings,
  MoreHorizontal,
} from "lucide-react";

export default function Sidebar() {
  const {
    projects,
    selectedProjectId,
    selectProject,
    removeProject,
    setShowNewProjectModal,
    setShowSettingsDialog,
  } = useStore();

  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteProject(id);
        removeProject(id);
      } catch (err) {
        console.error("Failed to delete project:", err);
      }
      setContextMenuId(null);
    },
    [removeProject]
  );

  return (
    <aside className="sidebar" id="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Brain size={18} />
        </div>
        <span className="sidebar-title">ProjectBrain</span>
      </div>

      {/* Projects label */}
      <div className="sidebar-section-label">Projects</div>

      {/* Project list */}
      <div className="project-list" id="project-list">
        {projects.length === 0 && (
          <div
            style={{
              padding: "20px 10px",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "12px",
            }}
          >
            No projects yet.
            <br />
            Create one to get started.
          </div>
        )}
        {projects.map((project) => (
          <div
            key={project.id}
            className={`project-item ${
              selectedProjectId === project.id ? "active" : ""
            }`}
            onClick={() => selectProject(project.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenuId(
                contextMenuId === project.id ? null : project.id
              );
            }}
            id={`project-${project.id}`}
          >
            <div className="project-item-icon">
              <FolderOpen size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="project-item-name">{project.name}</div>
              <div className="project-item-path">{project.repoPath}</div>
            </div>

            {/* Context menu trigger */}
            <button
              className="btn btn-ghost btn-icon"
              style={{
                opacity: selectedProjectId === project.id ? 1 : 0,
                transition: "opacity 0.15s",
                padding: "4px",
                width: "24px",
                height: "24px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenuId(
                  contextMenuId === project.id ? null : project.id
                );
              }}
            >
              <MoreHorizontal size={14} />
            </button>

            {/* Inline context menu */}
            {contextMenuId === project.id && (
              <div
                style={{
                  position: "absolute",
                  right: "16px",
                  top: "100%",
                  zIndex: 50,
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px",
                  boxShadow: "var(--shadow-elevated)",
                  minWidth: "140px",
                }}
              >
                <button
                  className="btn btn-ghost btn-sm"
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    color: "var(--color-danger)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id);
                  }}
                >
                  <Trash2 size={13} />
                  Delete project
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          className="btn-new-project"
          id="btn-new-project"
          onClick={() => setShowNewProjectModal(true)}
        >
          <Plus size={15} />
          New project
        </button>

        <button
          className="btn btn-ghost"
          style={{
            width: "100%",
            marginTop: "6px",
            justifyContent: "center",
          }}
          onClick={() => setShowSettingsDialog(true)}
        >
          <Settings size={14} />
          Settings
        </button>
      </div>
    </aside>
  );
}
