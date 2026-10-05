import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../lib/store";
import { readMemoryFile, writeMemoryFile, listMemoryFiles } from "../lib/tauri";
import { FileText, Save, RefreshCw } from "lucide-react";

const DEFAULT_FILES = [
  "MEMORY.md",
  "decisions.md",
  "conventions.md",
  "status.md",
  "people.md",
];

export default function MemoryPanel() {
  const { selectedProjectId } = useStore();

  const [files, setFiles] = useState<string[]>(DEFAULT_FILES);
  const [activeFile, setActiveFile] = useState("MEMORY.md");
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load file list
  useEffect(() => {
    if (!selectedProjectId) return;
    listMemoryFiles(selectedProjectId)
      .then((f) => {
        if (f.length > 0) setFiles(f);
      })
      .catch(() => {
        // Fallback to defaults
      });
  }, [selectedProjectId]);

  // Load file content
  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    readMemoryFile(selectedProjectId, activeFile)
      .then((c) => {
        setContent(c);
        setSavedContent(c);
      })
      .catch((err) => {
        setError(String(err));
        setContent("");
        setSavedContent("");
      })
      .finally(() => setLoading(false));
  }, [selectedProjectId, activeFile]);

  // Autosave with debounce
  const handleChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        if (!selectedProjectId) return;
        setSaving(true);
        try {
          await writeMemoryFile(selectedProjectId, activeFile, newContent);
          setSavedContent(newContent);
        } catch (err) {
          console.error("Autosave failed:", err);
        } finally {
          setSaving(false);
        }
      }, 1000);
    },
    [selectedProjectId, activeFile]
  );

  const isDirty = content !== savedContent;

  if (!selectedProjectId) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <FileText size={28} />
        </div>
        <div className="empty-state-title">Memory</div>
        <div className="empty-state-desc">
          Select a project to view and edit its memory files.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col flex-1">
      {/* File tabs */}
      <div className="memory-file-tabs">
        {files.map((file) => (
          <button
            key={file}
            className={`memory-file-tab ${activeFile === file ? "active" : ""}`}
            onClick={() => setActiveFile(file)}
          >
            {file}
          </button>
        ))}
      </div>

      {/* Status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 24px",
          fontSize: "11px",
          color: "var(--color-text-muted)",
          borderBottom: "1px solid var(--color-border-subtle)",
          flexShrink: 0,
        }}
      >
        {saving && (
          <>
            <RefreshCw
              size={11}
              style={{ animation: "spin 1s linear infinite" }}
            />
            Saving...
          </>
        )}
        {!saving && isDirty && (
          <>
            <Save size={11} />
            Unsaved changes
          </>
        )}
        {!saving && !isDirty && content && (
          <>
            <Save size={11} style={{ opacity: 0.5 }} />
            Saved
          </>
        )}
      </div>

      {/* Editor */}
      <div className="memory-editor">
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              color: "var(--color-text-muted)",
              fontSize: "13px",
            }}
          >
            Loading...
          </div>
        ) : error ? (
          <div
            style={{
              padding: "16px",
              borderRadius: "var(--radius-md)",
              background: "var(--color-danger-muted)",
              color: "var(--color-danger)",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Write your ${activeFile} content here...`}
            spellCheck={false}
          />
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
