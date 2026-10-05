import { useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TerminalPane from "./components/TerminalPane";
import MemoryPanel from "./components/MemoryPanel";
import SharePanel from "./components/SharePanel";
import NewProjectModal from "./components/NewProjectModal";
import SettingsDialog from "./components/SettingsDialog";
import { useStore } from "./lib/store";
import { listProjects } from "./lib/tauri";

export default function App() {
  const {
    projects,
    setProjects,
    selectedProjectId,
    selectProject,
    activeTab,
    setActiveTab,
  } = useStore();

  useEffect(() => {
    // Initial load of projects
    listProjects()
      .then((ps) => {
        setProjects(ps);
        if (ps.length > 0 && !selectedProjectId) {
          selectProject(ps[0].id);
        }
      })
      .catch((err) => console.error("Failed to load projects:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        {activeProject ? (
          <>
            <header className="main-header">
              <div className="main-header-left">
                <h1 className="main-header-title">{activeProject.name}</h1>
                <span className="main-header-path">
                  {activeProject.repoPath}
                </span>
              </div>
            </header>

            <div className="tab-bar">
              <button
                className={`tab ${activeTab === "terminal" ? "active" : ""}`}
                onClick={() => setActiveTab("terminal")}
              >
                Terminal
              </button>
              <button
                className={`tab ${activeTab === "memory" ? "active" : ""}`}
                onClick={() => setActiveTab("memory")}
              >
                Memory
              </button>
              <button
                className={`tab ${activeTab === "share" ? "active" : ""}`}
                onClick={() => setActiveTab("share")}
              >
                Share Live
              </button>
            </div>

            <div className="panel-content" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
              {activeTab === "terminal" && <TerminalPane />}
              {activeTab === "memory" && <MemoryPanel />}
              {activeTab === "share" && <SharePanel />}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-state-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
            </div>
            <div className="empty-state-title">No Project Selected</div>
            <div className="empty-state-desc">
              Select a project from the sidebar or create a new one to get
              started.
            </div>
          </div>
        )}
      </main>

      <NewProjectModal />
      <SettingsDialog />
    </div>
  );
}
