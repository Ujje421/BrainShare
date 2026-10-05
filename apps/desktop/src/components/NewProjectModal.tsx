import { useState, useCallback, type FormEvent } from "react";
import { useStore, type AgentType } from "../lib/store";
import { createProject } from "../lib/tauri";

export default function NewProjectModal() {
  const { showNewProjectModal, setShowNewProjectModal, addProject } =
    useStore();

  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [agentType, setAgentType] = useState<AgentType>("claude");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !repoPath.trim()) return;

      setLoading(true);
      setError(null);
      try {
        const project = await createProject({
          name: name.trim(),
          repoPath: repoPath.trim(),
          agentType,
        });
        addProject(project);
        setShowNewProjectModal(false);
        // Reset form
        setName("");
        setRepoPath("");
        setAgentType("claude");
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [name, repoPath, agentType, addProject, setShowNewProjectModal]
  );

  const handleClose = useCallback(() => {
    setShowNewProjectModal(false);
    setError(null);
  }, [setShowNewProjectModal]);

  if (!showNewProjectModal) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Create new project</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              className="form-input"
              type="text"
              placeholder="My Awesome App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="repo-path">
              Repository path
            </label>
            <input
              id="repo-path"
              className="form-input"
              type="text"
              placeholder="C:\Users\you\projects\my-app"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="agent-type">
              Agent type
            </label>
            <select
              id="agent-type"
              className="form-select"
              value={agentType}
              onChange={(e) =>
                setAgentType(e.target.value as AgentType)
              }
            >
              <option value="claude">Claude Code</option>
              <option value="codex">Codex</option>
              <option value="aider">Aider</option>
              <option value="cursor">Cursor</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-danger-muted)",
                color: "var(--color-danger)",
                fontSize: "12px",
                marginBottom: "12px",
              }}
            >
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !name.trim() || !repoPath.trim()}
            >
              {loading ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
