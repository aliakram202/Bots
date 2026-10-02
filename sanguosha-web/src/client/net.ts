// WebSocket client with automatic reconnect + a tiny external store for React.
import { useSyncExternalStore } from 'react';
import type { ChatMessage, ClientMessage, RoomView, ServerMessage } from '../shared/protocol';
import type { GameView } from '../game/engine/view';

export interface Session {
  code: string;
  playerId: string;
  token: string;
  name: string;
}

const KEY = (code: string) => `tkt:session:${code.toUpperCase()}`;

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(KEY(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(s: Session) {
  try {
    localStorage.setItem(KEY(s.code), JSON.stringify(s));
    localStorage.setItem('tkt:lastName', s.name);
  } catch {
    /* storage unavailable: session lasts for this tab only */
  }
}
export function clearSession(code: string) {
  try {
    localStorage.removeItem(KEY(code));
  } catch {
    /* ignore */
  }
}
export function lastName(): string {
  try {
    return localStorage.getItem('tkt:lastName') ?? '';
  } catch {
    return '';
  }
}

export interface NetState {
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';
  room: RoomView | null;
  game: GameView | null;
  deadline: number | null;
  clockOffset: number;
  chat: ChatMessage[];
  errors: { id: number; text: string }[];
  kicked: string | null;
  debugState: unknown;
  seats: string[] | null;
  views: Record<string, import('../game/engine/view').GameView> | null;
  latency: number | null;
}

const initial: NetState = {
  status: 'idle', room: null, game: null, deadline: null, clockOffset: 0, chat: [], errors: [], kicked: null, debugState: null, seats: null, views: null, latency: null,
};

class Net {
  state: NetState = initial;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private session: Session | null = null;
  private retry = 0;
  private retryTimer: number | null = null;
  private pingTimer: number | null = null;
  private errSeq = 0;
  private closedByUs = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;

  private set(patch: Partial<NetState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  connect(session: Session) {
    this.disconnect();
    this.closedByUs = false;
    this.session = session;
    this.state = { ...initial, status: 'connecting' };
    this.open();
  }

  private open() {
    const s = this.session;
    if (!s) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?room=${encodeURIComponent(s.code)}&token=${encodeURIComponent(s.token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.set({ status: 'open' });
      this.ping();
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.ping(), 15000);
    };
    ws.onmessage = (ev) => this.onMessage(JSON.parse(String(ev.data)) as ServerMessage);
    ws.onclose = (ev) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.closedByUs) return;
      if (ev.code === 4003 || ev.code === 4004 || ev.code === 4000) {
        this.set({ status: 'closed' });
        return;
      }
      this.set({ status: 'reconnecting' });
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      this.retryTimer = window.setTimeout(() => this.open(), delay);
    };
  }

  private ping() {
    this.send({ t: 'ping', ts: Date.now() });
  }

  private onMessage(m: ServerMessage) {
    switch (m.t) {
      case 'room':
        this.set({ room: m.room, chat: m.room.chat, game: m.room.phase === 'lobby' ? null : this.state.game });
        break;
      case 'game':
        this.set({ game: m.view, deadline: m.deadline, clockOffset: m.serverTime - Date.now(), seats: m.seats ?? null, views: m.views ?? null });
        break;
      case 'chat':
        if (!this.state.chat.some((c) => c.id === m.msg.id)) this.set({ chat: [...this.state.chat, m.msg].slice(-100) });
        break;
      case 'error':
        this.pushError(m.message);
        break;
      case 'pong':
        this.set({ latency: Date.now() - m.ts, clockOffset: m.serverTime - Date.now() });
        break;
      case 'kicked':
        this.set({ kicked: m.reason });
        if (this.session) clearSession(this.session.code);
        break;
      case 'debugState':
        this.set({ debugState: m.state });
        break;
    }
  }

  pushError(text: string) {
    const id = ++this.errSeq;
    this.set({ errors: [...this.state.errors, { id, text }].slice(-3) });
    window.setTimeout(() => this.set({ errors: this.state.errors.filter((e) => e.id !== id) }), 5000);
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  disconnect() {
    this.closedByUs = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export const net = new Net();

export function useNet(): NetState {
  return useSyncExternalStore(net.subscribe, net.getSnapshot);
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
