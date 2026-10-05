/**
 * ProjectBrain Relay Protocol
 *
 * Shared message types for WebSocket communication between
 * the host desktop app, relay server, and guest viewers.
 */

// ── Presence ───────────────────────────────────────────────

export interface User {
  name: string;
  role: "host" | "guest";
  canType: boolean;
}

// ── Messages ───────────────────────────────────────────────

export interface HelloMsg {
  t: "hello";
  role: "host" | "guest";
  name: string;
  token: string;
}

export interface OutputMsg {
  t: "output";
  /** PTY bytes, base64-encoded */
  data: string;
}

export interface InputMsg {
  t: "input";
  data: string;
  from: string;
}

export interface PresenceMsg {
  t: "presence";
  users: User[];
}

export interface GrantMsg {
  t: "grant";
  user: string;
  canType: boolean;
}

export interface EndMsg {
  t: "end";
}

export type Msg =
  | HelloMsg
  | OutputMsg
  | InputMsg
  | PresenceMsg
  | GrantMsg
  | EndMsg;

// ── Type guards ────────────────────────────────────────────

export function isMsgType<T extends Msg["t"]>(
  msg: Msg,
  t: T
): msg is Extract<Msg, { t: T }> {
  return msg.t === t;
}

// ── Project types (shared between frontend modules) ───────

export interface ProjectConfig {
  id: string;
  name: string;
  repoPath: string;
  agentType: "claude" | "codex";
  createdAt: string;
}
