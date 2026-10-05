import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "../lib/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

interface User {
  name: string;
  role: "host" | "guest";
  canType: boolean;
}

const DEFAULT_RELAY_URL = "ws://localhost:8787"; // wrangler dev default

export default function SharePanel() {
  const { selectedProjectId } = useStore();

  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY_URL);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Cleanup on unmount or project switch
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedProjectId]);

  const createRoom = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const httpUrl = relayUrl.replace(/^ws/, "http");
      const res = await fetch(`${httpUrl}/rooms`, { method: "POST" });
      if (!res.ok) throw new Error(`Relay returned ${res.status}`);
      const data = await res.json();
      setRoomId(data.roomId);
      setToken(data.token);

      // Connect as host
      const wsUrl = `${relayUrl}/rooms/${data.roomId}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ t: "hello", role: "host", name: "Host", token: data.token }));
        setConnected(true);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.t === "presence") {
          setUsers(msg.users);
        }
        if (msg.t === "input") {
          // Forward guest input to PTY (if they have permission)
          invoke("write_pty", { projectId: selectedProjectId, data: msg.data }).catch(console.error);
        }
      };

      ws.onerror = () => setError("WebSocket connection error");
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };

      // Listen to PTY output and forward to guests
      let unlisten: UnlistenFn | null = null;
      listen<string>(`pty_output_${selectedProjectId}`, (event) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // PTY payload is raw string. Protocol expects base64 string to avoid JSON corruption.
          // In JS, btoa handles base64 encoding.
          const base64Data = btoa(unescape(encodeURIComponent(event.payload)));
          wsRef.current.send(JSON.stringify({ t: "output", data: base64Data }));
        }
      }).then((un) => {
        unlisten = un;
      });

      // Attach cleanup to ws.onclose
      const originalOnClose = ws.onclose;
      ws.onclose = (ev) => {
        if (unlisten) unlisten();
        originalOnClose.call(ws, ev);
      };

    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  }, [relayUrl]);

  const endSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ t: "end" }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setRoomId(null);
    setToken(null);
    setUsers([]);
  }, []);

  const toggleGuestTyping = useCallback((userName: string, canType: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ t: "grant", user: userName, canType }));
    }
  }, []);

  const copyLink = useCallback(() => {
    if (!roomId || !token) return;
    const link = `${relayUrl.replace(/^ws/, "http")}/rooms/${roomId}/join?token=${token}`;
    navigator.clipboard.writeText(link);
  }, [roomId, token, relayUrl]);

  if (!selectedProjectId) {
    return <div style={{ padding: "24px", color: "var(--color-text-muted)" }}>No project selected.</div>;
  }

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
        Live Session Sharing
      </h2>

      {!connected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="relay-url">Relay URL</label>
            <input
              id="relay-url"
              className="form-input"
              value={relayUrl}
              onChange={(e) => setRelayUrl(e.target.value)}
              placeholder="ws://localhost:8787"
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={createRoom}
            disabled={creating}
            style={{ alignSelf: "flex-start" }}
          >
            {creating ? "Creating..." : "Start Sharing"}
          </button>

          {error && (
            <div style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-danger-muted)",
              color: "var(--color-danger)",
              fontSize: "12px",
            }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Connection info */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "12px 16px",
            background: "var(--color-bg-darker)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
          }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#22c55e", // green dot
              boxShadow: "0 0 6px #22c55e80",
            }} />
            <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Live — Room <code style={{ fontSize: "11px", background: "var(--color-bg-dark)", padding: "2px 6px", borderRadius: "4px" }}>{roomId}</code>
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <button className="btn btn-ghost" onClick={copyLink} style={{ fontSize: "12px", padding: "4px 8px" }}>
                Copy Invite Link
              </button>
              <button className="btn btn-ghost" onClick={endSession} style={{ fontSize: "12px", padding: "4px 8px", color: "var(--color-danger)" }}>
                End Session
              </button>
            </div>
          </div>

          {/* Participants */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "8px" }}>
              Participants ({users.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {users.map((user) => (
                <div
                  key={user.name}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--color-bg-darker)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ 
                      fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
                      background: user.role === "host" ? "var(--color-accent-muted)" : "var(--color-bg-dark)",
                      color: user.role === "host" ? "var(--color-accent)" : "var(--color-text-muted)",
                      fontWeight: 600, textTransform: "uppercase",
                    }}>
                      {user.role}
                    </span>
                    <span style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>{user.name}</span>
                  </div>
                  {user.role === "guest" && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => toggleGuestTyping(user.name, !user.canType)}
                      style={{
                        fontSize: "11px", padding: "2px 8px",
                        color: user.canType ? "var(--color-danger)" : "var(--color-accent)",
                      }}
                    >
                      {user.canType ? "Revoke Typing" : "Grant Typing"}
                    </button>
                  )}
                </div>
              ))}
              {users.length === 0 && (
                <div style={{ fontSize: "13px", color: "var(--color-text-muted)", padding: "8px" }}>
                  No participants yet. Share the invite link!
                </div>
              )}
            </div>
          </div>

          {/* Security warning */}
          <div style={{
            padding: "10px 14px", borderRadius: "var(--radius-sm)",
            background: "rgba(234, 179, 8, 0.1)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            fontSize: "12px", color: "rgb(234, 179, 8)",
          }}>
            ⚠️ Guests with typing permission can run commands on your machine. Only grant to trusted teammates.
          </div>
        </div>
      )}
    </div>
  );
}
