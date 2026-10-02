// HTTP + WebSocket entrypoint. One persistent Node process serves the API, the WebSocket
// endpoint (/ws) and the built client (dist/client) on a single port.

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { ClientMessageSchema, CreateRoomSchema, JoinRoomSchema, type ServerMessage } from '../shared/protocol';
import { RoomManager, type Conn } from './rooms';
import { FileRoomStore, MemoryRoomStore } from './store';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? path.resolve('data/rooms');
const DEBUG_ALLOWED = process.env.ENABLE_DEBUG === '1';
const STORE = process.env.STORE ?? 'file';
const CLIENT_DIR = path.resolve(process.env.CLIENT_DIR ?? 'dist/client');
const startedAt = Date.now();

const store = STORE === 'memory' ? new MemoryRoomStore() : new FileRoomStore(DATA_DIR);
const manager = new RoomManager(store, { debugAllowed: DEBUG_ALLOWED, botDelayMs: Number(process.env.BOT_DELAY_MS ?? 900) });

const app = new Hono();

app.get('/health', (c) =>
  c.json({
    ok: true,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    rooms: manager.rooms.size,
    websocket: { path: '/ws', clients: wss?.clients.size ?? 0 },
  }),
);

app.post('/api/rooms', async (c) => {
  const parsed = CreateRoomSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Please enter a display name (1–24 characters).' }, 400);
  const { room, member } = manager.create(parsed.data.name, !!parsed.data.debug);
  return c.json({ code: room.code, playerId: member.id, token: member.token, debug: room.debug });
});

app.post('/api/rooms/:code/join', async (c) => {
  const parsed = JoinRoomSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Please enter a display name (1–24 characters).' }, 400);
  const r = manager.join(c.req.param('code'), parsed.data.name);
  if (typeof r === 'string') return c.json({ error: r }, 400);
  return c.json({ code: r.room.code, playerId: r.member.id, token: r.member.token });
});

app.get('/api/rooms/:code', (c) => {
  const room = manager.get(c.req.param('code'));
  if (!room) return c.json({ exists: false }, 404);
  return c.json({
    exists: true,
    code: room.code,
    phase: room.game ? 'game' : 'lobby',
    players: room.members.length,
    debug: room.debug,
  });
});

app.get('/api/config', (c) => c.json({ debugAllowed: DEBUG_ALLOWED }));

// Static client (production build). SPA fallback so /room/ABCD12 works on refresh.
if (existsSync(CLIENT_DIR)) {
  const rel = path.relative(process.cwd(), CLIENT_DIR) || '.';
  app.use('/assets/*', serveStatic({ root: rel }));
  app.use('/*', serveStatic({ root: rel }));
  const indexHtml = readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf8');
  app.get('*', (c) => c.html(indexHtml));
}

// ───────────── WebSocket ─────────────

let wss: WebSocketServer | null = null;

function attachWs(server: import('node:http').Server) {
  wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss!.handleUpgrade(req, socket, head, (ws) => onConnection(ws, url));
  });

  // Heartbeat: terminate connections that stop answering pings.
  const alive = new WeakMap<WebSocket, boolean>();
  wss.on('connection', (ws) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
  });
  const hb = setInterval(() => {
    for (const ws of wss!.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 25_000);
  hb.unref();
}

function onConnection(ws: WebSocket, url: URL) {
  wss!.emit('connection', ws);
  const code = (url.searchParams.get('room') ?? '').toUpperCase();
  const tok = url.searchParams.get('token') ?? '';
  const room = manager.get(code);
  const send = (m: ServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };
  if (!room) {
    send({ t: 'error', message: 'Room not found.' });
    ws.close(4004, 'room not found');
    return;
  }
  const member = room.memberByToken(tok);
  if (!member) {
    send({ t: 'error', message: 'Your session for this room is not valid. Join the room again.' });
    ws.close(4003, 'bad token');
    return;
  }
  const conn: Conn = { send, close: (c, r) => ws.close(c, r) };
  room.attach(member, conn);

  let msgCount = 0;
  const rate = setInterval(() => (msgCount = 0), 1000);
  rate.unref();

  ws.on('message', (raw) => {
    if (++msgCount > 40) return; // simple flood protection
    let data: unknown;
    try {
      data = JSON.parse(String(raw));
    } catch {
      send({ t: 'error', message: 'Malformed message.' });
      return;
    }
    const parsed = ClientMessageSchema.safeParse(data);
    if (!parsed.success) {
      send({ t: 'error', message: 'Invalid message.' });
      return;
    }
    const current = manager.get(code);
    if (!current || !current.members.includes(member)) return;
    const err = current.handle(member, parsed.data);
    if (err) send({ t: 'error', message: err });
  });
  ws.on('close', () => {
    clearInterval(rate);
    const current = manager.get(code);
    if (current) current.detach(member, conn);
  });
}

async function main() {
  const restored = await manager.restore();
  const server = serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
    console.log(`[server] Three Kingdoms Table listening on http://localhost:${info.port} (restored ${restored} room(s), debug ${DEBUG_ALLOWED ? 'ON' : 'off'})`);
  });
  attachWs(server as unknown as import('node:http').Server);
  setInterval(() => manager.sweep(), 10 * 60_000).unref();

  const shutdown = async () => {
    console.log('[server] shutting down, saving rooms…');
    await manager.flush();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
