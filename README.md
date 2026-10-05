# ProjectBrain 🧠

**Every project gets its own isolated brain.**

ProjectBrain is an agent-agnostic desktop application that provides your AI coding agents with a dedicated, persistent memory layer. When an agent works on a project, its context is isolated and saved directly into the project's markdown files. On your next session, the agent picks up exactly where it left off, maintaining full context and continuity.

Additionally, ProjectBrain features a live relay system that lets you share your live terminal sessions with teammates. They can watch the agent work and even send input directly from their own browser, enabling seamless collaboration.

---

## 🚀 Key Features

- 🏗 **Agent Agnostic**: Designed to work with Claude Code, Codex, Aider, Cursor, or any custom CLI agent.
- 💾 **Persistent Memory Engine**: Automatically compiles and injects `status.md`, `conventions.md`, and `decisions.md` into the agent's context (e.g., `CLAUDE.md`, `.cursorrules`).
- 🔄 **Session Summarization**: Uses Gemini 1.5 Pro (or Gemini 3.1 Pro) to automatically summarize a session's terminal transcript and propose updates to the project's memory files.
- 📡 **Live Sharing Relay**: Built-in Cloudflare Worker relay lets you stream your terminal session to a web URL, allowing teammates to watch and interact in real-time.
- 🔒 **Secure by Design**: The relay server acts as a "dumb" byte-forwarder. No code or memory is ever stored in the cloud. API keys are safely stored in your local OS keychain.

---

## 🏗 Project Structure

ProjectBrain is a Tauri v2 monorepo consisting of three main packages:

1. **`apps/desktop`**: The Tauri + React frontend. Handles project management, the embedded terminal (xterm.js), memory compilation, LLM summarization, and OS integration.
2. **`apps/relay`**: A Cloudflare Worker (using Durable Objects) that acts as a secure, fast byte-forwarding relay for multiplayer terminal sharing.
3. **`packages/protocol`**: Shared TypeScript types for WebSocket communication between the desktop app and the relay.

---

## 🛠 Setup & Running Locally

### Prerequisites
- Node.js (v20+)
- Rust (latest stable)
- Tauri dependencies for your OS (Windows Build Tools, WebKit2GTK on Linux, etc.)
- A Gemini API Key (for session summarization)

### 1. Install Dependencies

Clone the repository and install dependencies from the root:
```bash
npm install
```

### 2. Start the Relay Server (Local Dev)
The sharing feature requires the Cloudflare Worker relay to be running.
```bash
cd apps/relay
npm run dev
```
*This will start the relay locally at `ws://localhost:8787`.*

### 3. Start the Desktop App
In a new terminal window, run the Tauri development server:
```bash
cd apps/desktop
npm run tauri dev
```

### 4. Configure Your API Key
1. In the desktop app, navigate to **Settings**.
2. Enter your Gemini API Key. It will be securely stored in your OS keychain using the `keyring` crate.

---

## 📖 Usage Guide

1. **Add a Project**: Click "Add Project" and point it to a local Git repository. Choose the agent you want to use (e.g., Claude Code).
2. **Start a Session**: Select the project and click "Restart Session". An embedded terminal will spawn in the project's directory with the agent's context already injected into `CLAUDE.md` (or equivalent).
3. **Share the Session**: Go to the "Share" tab, ensure the relay URL is correct, and click "Start Sharing". Copy the invite link and send it to a teammate. You can grant them typing permissions directly from the UI!
4. **End & Summarize**: When the agent finishes, click "Summarize Session". The transcript is sent to the LLM, and a modal will appear proposing diffs to your memory files. Review and click "Apply to Memory".

---

## 🎯 Architecture Constraints (v1 Scope)

This is the v1 release, deliberately scoped for maximum impact with minimal complexity:
- **In Scope**: Local persistence (markdown), embedded PTY, session summarization, real-time dumb relay.
- **Out of Scope (for now)**: Cloud sandboxes, Slack/Linear integrations, vector databases (RAG), enterprise SSO, mobile apps.

---

## 📜 License

Copyright (c) 2026 Ujje421. All rights reserved.

See `LICENSE` for details on permitted use.
