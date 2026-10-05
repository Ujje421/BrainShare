/**
 * ProjectBrain Relay — Cloudflare Worker entrypoint
 *
 * Routes:
 *   POST /rooms          → create a new room, returns { roomId, token }
 *   GET  /rooms/:id/ws   → WebSocket upgrade into the Durable Object
 *   GET  /health         → 200 OK
 */

export { Room } from "./Room";

interface Env {
  ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // POST /rooms — create a room
    if (request.method === "POST" && url.pathname === "/rooms") {
      const roomId = crypto.randomUUID();
      const id = env.ROOM.idFromName(roomId);
      const stub = env.ROOM.get(id);

      // Ask the Durable Object to initialize and return a token
      const initRes = await stub.fetch(
        new Request("https://internal/init", { method: "POST" })
      );
      const { token } = (await initRes.json()) as { token: string };

      return Response.json(
        { roomId, token },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // GET /rooms/:id/join — serve HTML client for guests
    const joinMatch = url.pathname.match(/^\/rooms\/([^/]+)\/join$/);
    if (joinMatch) {
      const roomId = joinMatch[1];
      const token = url.searchParams.get("token") || "";
      const html = generateGuestHtml(roomId, token);
      return new Response(html, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    // GET /rooms/:id/ws — WebSocket upgrade
    const wsMatch = url.pathname.match(/^\/rooms\/([^/]+)\/ws$/);
    if (wsMatch) {
      const roomId = wsMatch[1];
      const id = env.ROOM.idFromName(roomId);
      const stub = env.ROOM.get(id);
      return stub.fetch(
        new Request("https://internal/ws", {
          headers: request.headers,
        })
      );
    }

    return new Response("Not found", { status: 404 });
  },
};

function generateGuestHtml(roomId: string, token: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>ProjectBrain Live Session</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.3.0/css/xterm.css" />
    <style>
      body { margin: 0; padding: 20px; background: #0f111a; color: #fff; font-family: system-ui, sans-serif; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
      #terminal { flex: 1; overflow: hidden; border-radius: 8px; border: 1px solid #333; padding: 8px; background: #000; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .badge { background: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
      .badge.connected { background: #166534; color: #4ade80; }
    </style>
  </head>
  <body>
    <div class="header">
      <div><strong>ProjectBrain</strong> Live Session</div>
      <div id="status" class="badge">Connecting...</div>
    </div>
    <div id="terminal"></div>

    <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.3.0/lib/xterm.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.8.0/lib/addon-fit.js"></script>
    <script>
      const term = new Terminal({ theme: { background: '#000' } });
      const fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.open(document.getElementById('terminal'));
      fitAddon.fit();
      window.addEventListener('resize', () => fitAddon.fit());

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = wsProtocol + '//' + window.location.host + '/rooms/${roomId}/ws';
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        document.getElementById('status').textContent = 'Connected';
        document.getElementById('status').classList.add('connected');
        ws.send(JSON.stringify({ t: 'hello', role: 'guest', name: 'Guest_' + Math.floor(Math.random()*1000), token: '${token}' }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.t === 'output') {
          term.write(atob(msg.data));
        } else if (msg.t === 'end') {
          term.write('\\r\\n\\x1b[31m[Session ended by host]\\x1b[0m\\r\\n');
          ws.close();
        }
      };

      ws.onclose = () => {
        document.getElementById('status').textContent = 'Disconnected';
        document.getElementById('status').classList.remove('connected');
      };

      term.onData(data => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ t: 'input', data }));
        }
      });
    </script>
  </body>
</html>`;
}
