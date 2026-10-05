# ProductBrain – Product Spec v1

## One-line promise
Every project gets its own isolated brain for AI coding agents, and your team can join the same live session.

## What's in v1

1. **Projects** — each with its own memory stored as plain markdown on disk.
2. **Agent launch** — spawn an agent (Claude Code first, Codex second) in an embedded terminal, with ONLY that project's memory loaded.
3. **Session summarization** — on session end, summarize the transcript and update the project's memory (with user approval).
4. **Memory viewer/editor** — users can see and fix what the agent "knows."
5. **Live sharing** — a teammate opens a link, watches live, and can send input (host can approve or revoke).

## What's NOT in v1

- Cloud sandboxes
- Slack/Linear bots
- Enterprise SSO/permissions
- Custom retrieval engine / vector DB
- Mobile app
- Our own model

## User data layout

```
~/ProjectBrain/
└─ projects/
   └─ <project-id>/
      ├─ project.json               # name, repo path, agent type
      ├─ memory/
      │  ├─ MEMORY.md               # index (short, always loaded)
      │  ├─ decisions.md            # architecture/product decisions
      │  ├─ conventions.md          # code style, tooling rules
      │  ├─ status.md               # what's done, what's next
      │  └─ people.md               # optional: who owns what
      └─ sessions/
         ├─ 2026-10-06T10-30.log    # raw transcript
         └─ 2026-10-06T10-30.md     # generated summary
```

## Memory injection flow

1. `memory_engine` builds a context string from the project's memory files (≤ ~8k tokens).
2. Write it into a managed block in `CLAUDE.md` / `AGENTS.md`:
   ```
   <!-- projectbrain:start -->
   ...generated memory...
   <!-- projectbrain:end -->
   ```
3. Launch agent CLI in the project's repo directory via PTY.
4. On exit, summarizer sends trimmed transcript to LLM → structured JSON updates.
5. `memory_engine` merges updates into markdown files (dedupe, drop stale).
6. Show proposed diff to user for accept/reject.

## Security requirements

- Relay tokens: random, short-lived, revocable. Guests read-only by default.
- Never log API keys or terminal contents on the relay.
- Warn host that a guest with typing can run commands on their machine.
- Redact secrets from transcripts before summarization.
- Rate limits on relay.
