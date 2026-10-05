/**
 * Room — Durable Object that manages a single shared session.
 *
 * Rules:
 *  - Exactly one "host" connection per room.
 *  - Multiple "guest" connections.
 *  - Guests are read-only by default. Host can grant/revoke typing.
 *  - The relay NEVER stores code or memory — it only forwards bytes.
 */

interface User {
  name: string;
  role: "host" | "guest";
  canType: boolean;
}

interface Connection {
  ws: WebSocket;
  user: User;
}

export class Room {
  private state: DurableObjectState;
  private connections: Map<WebSocket, Connection> = new Map();
  private token: string = "";
  private hostConnected = false;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /init — host creates the room and gets a token
    if (request.method === "POST" && url.pathname === "/init") {
      this.token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      this.hostConnected = false;
      this.connections.clear();
      return Response.json({ token: this.token });
    }

    // GET /ws — upgrade to WebSocket
    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const [client, server] = Object.values(new WebSocketPair());
      this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  private handleSession(ws: WebSocket) {
    ws.accept();

    ws.addEventListener("message", (event: MessageEvent) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      // First message must be "hello"
      if (msg.t === "hello") {
        if (msg.token !== this.token) {
          ws.send(JSON.stringify({ t: "error", message: "Invalid token" }));
          ws.close(4001, "Invalid token");
          return;
        }

        if (msg.role === "host") {
          if (this.hostConnected) {
            ws.send(JSON.stringify({ t: "error", message: "Host already connected" }));
            ws.close(4002, "Host already connected");
            return;
          }
          this.hostConnected = true;
        }

        const user: User = {
          name: msg.name || (msg.role === "host" ? "Host" : "Guest"),
          role: msg.role,
          canType: msg.role === "host", // host can always type
        };
        this.connections.set(ws, { ws, user });
        this.broadcastPresence();
        return;
      }

      const conn = this.connections.get(ws);
      if (!conn) return;

      switch (msg.t) {
        case "output":
          // Only host can send output
          if (conn.user.role !== "host") return;
          this.broadcastToGuests(JSON.stringify(msg));
          break;

        case "input":
          // Only guests with canType permission
          if (conn.user.role !== "guest" || !conn.user.canType) return;
          this.sendToHost(JSON.stringify({ ...msg, from: conn.user.name }));
          break;

        case "grant":
          // Only host can grant/revoke
          if (conn.user.role !== "host") return;
          for (const [, c] of this.connections) {
            if (c.user.name === msg.user && c.user.role === "guest") {
              c.user.canType = msg.canType;
            }
          }
          this.broadcastPresence();
          break;

        case "end":
          if (conn.user.role !== "host") return;
          this.broadcast(JSON.stringify({ t: "end" }));
          // Close all connections
          for (const [socket] of this.connections) {
            socket.close(1000, "Session ended");
          }
          this.connections.clear();
          this.hostConnected = false;
          break;
      }
    });

    ws.addEventListener("close", () => {
      const conn = this.connections.get(ws);
      if (conn?.user.role === "host") {
        this.hostConnected = false;
      }
      this.connections.delete(ws);
      this.broadcastPresence();
    });

    ws.addEventListener("error", () => {
      this.connections.delete(ws);
    });
  }

  private broadcast(data: string) {
    for (const [ws] of this.connections) {
      try { ws.send(data); } catch { /* ignore closed */ }
    }
  }

  private broadcastToGuests(data: string) {
    for (const [ws, conn] of this.connections) {
      if (conn.user.role === "guest") {
        try { ws.send(data); } catch { /* ignore */ }
      }
    }
  }

  private sendToHost(data: string) {
    for (const [ws, conn] of this.connections) {
      if (conn.user.role === "host") {
        try { ws.send(data); } catch { /* ignore */ }
      }
    }
  }

  private broadcastPresence() {
    const users = Array.from(this.connections.values()).map((c) => c.user);
    this.broadcast(JSON.stringify({ t: "presence", users }));
  }
}
