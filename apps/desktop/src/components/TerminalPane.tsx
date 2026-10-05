import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SerializeAddon } from "@xterm/addon-serialize";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../lib/store";
import "@xterm/xterm/css/xterm.css";

interface PtyOutputEvent {
  projectId: string;
  data: string;
}

export default function TerminalPane() {
  const { selectedProjectId, projects } = useStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const activeProjectId = useRef<string | null>(null);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState<{status: string, conventions: string, decisions: string} | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  const writeToPty = useCallback(async (data: string) => {
    if (!selectedProjectId) return;
    try {
      await invoke("write_pty", { projectId: selectedProjectId, data });
    } catch (err) {
      console.error("Failed to write to pty:", err);
    }
  }, [selectedProjectId]);

  const spawnPty = useCallback(async (projectId: string, repoPath: string) => {
    try {
      await invoke("spawn_pty", { projectId, repoPath });
    } catch (err) {
      console.error("Failed to spawn pty:", err);
    }
  }, []);

  const resizePty = useCallback(async (projectId: string, rows: number, cols: number) => {
    try {
      await invoke("resize_pty", { projectId, rows, cols });
    } catch (err) {
      console.error("Failed to resize pty:", err);
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current || !selectedProjectId) return;

    activeProjectId.current = selectedProjectId;

    // Initialize xterm
    const term = new Terminal({
      theme: {
        background: "#0f172a", // Match Tailwind gray-950
        foreground: "#f8fafc", // Match Tailwind gray-50
        cursor: "#38bdf8",     // Match Tailwind sky-400
        selectionBackground: "rgba(56, 189, 248, 0.3)",
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
    });
    
    const fitAddon = new FitAddon();
    const serializeAddon = new SerializeAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(serializeAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    serializeAddonRef.current = serializeAddon;

    // Handle user input
    const dataDisposable = term.onData((data) => {
      writeToPty(data);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const { rows, cols } = xtermRef.current;
        resizePty(selectedProjectId, rows, cols);
      }
    });
    resizeObserver.observe(terminalRef.current);

    // Listen for PTY output from backend
    const unlistenPromise = listen<PtyOutputEvent>("pty_output", (event) => {
      if (event.payload.projectId === activeProjectId.current) {
        term.write(event.payload.data);
      }
    });

    // Spawn the PTY on the backend
    if (activeProject) {
      spawnPty(activeProject.id, activeProject.repoPath).then(() => {
        if (xtermRef.current) {
          const { rows, cols } = xtermRef.current;
          resizePty(activeProject.id, rows, cols);
        }
      });
    }

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      unlistenPromise.then((unlisten) => unlisten());
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      serializeAddonRef.current = null;
    };
  }, [selectedProjectId, activeProject, writeToPty, spawnPty, resizePty]);

  const handleSummarize = async () => {
    if (!selectedProjectId || !serializeAddonRef.current) return;
    
    setIsSummarizing(true);
    setSummaryError(null);
    setSummaryData(null);
    try {
      const transcript = serializeAddonRef.current.serialize();
      const updates = await invoke<{status: string, conventions: string, decisions: string}>("summarize_session", {
        projectId: selectedProjectId,
        transcript,
      });
      setSummaryData(updates);
    } catch (err) {
      setSummaryError(String(err));
    } finally {
      setIsSummarizing(false);
    }
  };

  const applySummary = async () => {
    if (!selectedProjectId || !summaryData) return;
    try {
      await invoke("write_memory_file", { projectId: selectedProjectId, fileName: "status.md", content: summaryData.status });
      await invoke("write_memory_file", { projectId: selectedProjectId, fileName: "conventions.md", content: summaryData.conventions });
      await invoke("write_memory_file", { projectId: selectedProjectId, fileName: "decisions.md", content: summaryData.decisions });
      setSummaryData(null);
    } catch (err) {
      alert("Failed to save memory: " + err);
    }
  };

  if (!selectedProjectId) {
    return <div className="p-4 text-[var(--color-text-muted)]">No project selected.</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-bg-darker)]">
      <div className="flex px-4 py-2 bg-[var(--color-bg-dark)] border-b border-[var(--color-border)] items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>Terminal ({activeProject?.repoPath})</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: "11px" }}
            onClick={() => {
              if (activeProject) {
                spawnPty(activeProject.id, activeProject.repoPath);
              }
            }}
          >
            Restart Session
          </button>
          <button 
            className="btn btn-primary" style={{ padding: "4px 8px", fontSize: "11px" }}
            onClick={handleSummarize}
            disabled={isSummarizing}
          >
            {isSummarizing ? "Summarizing..." : "Summarize Session"}
          </button>
        </div>
      </div>
      <div 
        ref={terminalRef} 
        className="flex-1 w-full h-full p-2 overflow-hidden" 
      />

      {/* Summary Review Modal */}
      {(summaryData || summaryError) && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: "800px", width: "90%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <h2 className="modal-title">Review Session Summary</h2>
            
            {summaryError ? (
              <div style={{ color: "var(--color-danger)" }}>{summaryError}</div>
            ) : summaryData ? (
              <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <strong>Proposed status.md</strong>
                  <pre style={{ background: "var(--color-bg-darker)", padding: "12px", borderRadius: "4px", fontSize: "12px", whiteSpace: "pre-wrap" }}>
                    {summaryData.status}
                  </pre>
                </div>
                <div>
                  <strong>Proposed conventions.md</strong>
                  <pre style={{ background: "var(--color-bg-darker)", padding: "12px", borderRadius: "4px", fontSize: "12px", whiteSpace: "pre-wrap" }}>
                    {summaryData.conventions}
                  </pre>
                </div>
                <div>
                  <strong>Proposed decisions.md</strong>
                  <pre style={{ background: "var(--color-bg-darker)", padding: "12px", borderRadius: "4px", fontSize: "12px", whiteSpace: "pre-wrap" }}>
                    {summaryData.decisions}
                  </pre>
                </div>
              </div>
            ) : null}

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setSummaryData(null); setSummaryError(null); }}
              >
                Cancel
              </button>
              {!summaryError && (
                <button className="btn btn-primary" onClick={applySummary}>
                  Apply to Memory
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
