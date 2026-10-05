import { useState, useEffect } from "react";
import { useStore } from "../lib/store";
import { invoke } from "@tauri-apps/api/core";

export default function SettingsDialog() {
  const { showSettingsDialog, setShowSettingsDialog } = useStore();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (showSettingsDialog) {
      invoke<string>("get_api_key")
        .then((key) => {
          setApiKey(key);
          setSaved(false);
        })
        .catch(console.error);
    }
  }, [showSettingsDialog]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await invoke("set_api_key", { key: apiKey });
      setSaved(true);
      setTimeout(() => setShowSettingsDialog(false), 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!showSettingsDialog) return null;

  return (
    <div
      className="modal-overlay"
      onClick={() => setShowSettingsDialog(false)}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Settings</h2>
        
        <div className="form-group" style={{ marginTop: "16px" }}>
          <label className="form-label" htmlFor="api-key">
            Gemini API Key (stored securely in OS keychain)
          </label>
          <input
            id="api-key"
            type="password"
            className="form-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
          />
        </div>

        <div className="modal-actions" style={{ marginTop: "24px" }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowSettingsDialog(false)}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
