# ProjectBrain – Architecture

## Overview

```
┌──────────────────────── Tauri app (host's machine) ────────────────────────┐
│ React + Tailwind UI                                                         │
│  ├─ Project sidebar                                                         │
│  ├─ Terminal pane (xterm.js)                                                │
│  ├─ Memory panel (markdown viewer/editor)                                   │
│  └─ Share panel (link, participants, approve/revoke)                        │
│                     │ Tauri commands + events                               │
│ Rust core                                                                   │
│  ├─ project_store   (reads/writes ~/ProjectBrain/projects/<id>/)            │
│  ├─ memory_engine   (build context, summarize, merge)                       │
│  ├─ pty_manager     (spawn agent CLI in a PTY, stream output)               │
│  ├─ session_log     (append-only transcript per session)                    │
│  └─ relay_client    (WebSocket to relay, forwards PTY output/input)         │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ WebSocket (wss)
                         ┌────────▼────────┐
                         │  Relay server   │  Cloudflare Worker + Durable Object
                         │  (1 room = 1    │  per session. Only forwards messages.
                         │   session)      │  Does NOT store code or memory.
                         └────────┬────────┘
                                  │ WebSocket
                         ┌────────▼────────┐
                         │ Guest viewer    │  Small React web page (or the same
                         │ (teammate)      │  Tauri app) with xterm.js read/write
                         └─────────────────┘
```

## Key decisions

- **Markdown on disk is the source of truth** for memory. Easy to inspect, edit, and git-version. No vector DB in v1.
- **Isolation by construction:** the agent process starts with its working directory inside the project, and the ONLY memory injected is that project's file. Never share state between projects.
- **Relay is dumb:** it forwards bytes between host and guests. Code stays on the host's disk.
- **Bring your own API key** for summarization, stored in the OS keychain (Tauri plugin stronghold or keyring crate).

## Monorepo layout

```
projectbrain/
├─ apps/
│  ├─ desktop/                      # Tauri app
│  │  ├─ src/                       # React frontend
│  │  │  ├─ main.tsx
│  │  │  ├─ App.tsx
│  │  │  ├─ components/
│  │  │  │  ├─ Sidebar.tsx
│  │  │  │  ├─ TerminalPane.tsx
│  │  │  │  ├─ MemoryPanel.tsx
│  │  │  │  ├─ SharePanel.tsx
│  │  │  │  └─ SettingsDialog.tsx
│  │  │  ├─ lib/
│  │  │  │  ├─ tauri.ts            # typed invoke() wrappers
│  │  │  │  └─ store.ts            # zustand state
│  │  │  └─ styles/index.css        # Tailwind
│  │  └─ src-tauri/
│  │     ├─ Cargo.toml
│  │     ├─ tauri.conf.json
│  │     └─ src/
│  │        ├─ main.rs
│  │        ├─ commands.rs          # exposed to frontend
│  │        ├─ project_store.rs
│  │        ├─ memory_engine.rs
│  │        ├─ pty_manager.rs
│  │        ├─ session_log.rs
│  │        ├─ summarizer.rs        # calls LLM API with user's key
│  │        └─ relay_client.rs
│  └─ relay/                        # Cloudflare Worker
│     ├─ src/index.ts               # routes: POST /rooms, GET /rooms/:id/ws
│     ├─ src/Room.ts                # Durable Object
│     └─ wrangler.toml
├─ packages/
│  └─ protocol/                     # shared TypeScript types for messages
│     └─ src/index.ts
├─ docs/
│  ├─ PRODUCT.md
│  └─ ARCHITECTURE.md
└─ README.md
```

## Message protocol (relay)

All messages are JSON over WebSocket.

```ts
type Msg =
  | { t: "hello"; role: "host" | "guest"; name: string; token: string }
  | { t: "output"; data: string }              // host -> guests (PTY bytes, base64 or utf8)
  | { t: "input"; data: string; from: string } // guest -> host (requires permission)
  | { t: "presence"; users: { name: string; role: string; canType: boolean }[] }
  | { t: "grant"; user: string; canType: boolean } // host -> relay
  | { t: "end" };
```

Rules:
- Guests are read-only by default
- Host must grant typing per guest
- Room tokens are random, expire, and can be revoked
