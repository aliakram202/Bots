// Room lifecycle, presence, timers, bots and game hosting. Transport-agnostic: connections are
// anything with send()/close(), so this is unit-testable without real sockets.

import { randomBytes, randomInt, webcrypto } from 'node:crypto';
import { Game } from '../game/engine/game';
import { engine } from '../game/engine';
import { botAnswer } from '../game/engine/bot';
import { Rng } from '../game/engine/rng';
import { viewFor } from '../game/engine/view';
import type { Answer, GameConfig, Scenario } from '../game/engine/types';
import type { DebugAction } from '../game/engine/debug';
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type ChatMessage,
  type ClientMessage,
  type RoomSettings,
  type RoomView,
  type ServerMessage,
} from '../shared/protocol';
import type { RoomStore, SavedMember, SavedRoom } from './store';

export interface Conn {
  send(msg: ServerMessage): void;
  close(code?: number, reason?: string): void;
}

export interface Member extends SavedMember {
  connected: boolean;
  lastSeen: number;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BOT_NAMES = ['Bot Wen', 'Bot Wu', 'Bot Ling', 'Bot Shu', 'Bot Feng', 'Bot Yun', 'Bot Lei', 'Bot Shan'];

export const HOST_GRACE_MS = 45_000;
export const DISCONNECTED_DECISION_MS = 20_000;
const SELECT_MS = 90_000;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export function makeCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}
const token = () => randomBytes(24).toString('base64url');
const memberId = () => `u${randomBytes(5).toString('hex')}`;
function secureSeed(): [number, number, number, number] {
  const a = new Uint32Array(4);
  webcrypto.getRandomValues(a);
  return [a[0], a[1], a[2], a[3]];
}

export interface RoomOptions {
  debugAllowed: boolean;
  botDelayMs: number;
}

export class Room {
  code: string;
  hostId = '';
  createdAt = Date.now();
  updatedAt = Date.now();
  debug: boolean;
  members: Member[] = [];
  settings: RoomSettings = { ...DEFAULT_SETTINGS };
  chat: ChatMessage[] = [];
  game: Game | null = null;
  conns = new Map<string, Set<Conn>>();
  /** decisionId:player → absolute deadline (ms). */
  deadlines = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private botTimer: NodeJS.Timeout | null = null;
  private hostTimer: NodeJS.Timeout | null = null;
  private chatSeq = 0;
  private botRng = new Rng(secureSeed());

  constructor(
    code: string,
    private manager: RoomManager,
    debug = false,
  ) {
    this.code = code;
    this.debug = debug;
  }

  // ───────────── membership ─────────────

  addMember(name: string, isBot = false): Member {
    const m: Member = { id: memberId(), name: name.slice(0, 24), token: token(), ready: isBot, isBot, connected: false, lastSeen: Date.now() };
    this.members.push(m);
    if (!this.hostId && !isBot) this.hostId = m.id;
    this.system(`${m.name} joined the room.`);
    this.touch();
    return m;
  }

  memberByToken(tok: string): Member | undefined {
    return this.members.find((m) => m.token === tok && !m.isBot);
  }

  attach(m: Member, conn: Conn) {
    if (!this.conns.has(m.id)) this.conns.set(m.id, new Set());
    this.conns.get(m.id)!.add(conn);
    const wasConnected = m.connected;
    m.connected = true;
    m.lastSeen = Date.now();
    if (!wasConnected && this.game) this.system(`${m.name} reconnected.`);
    this.broadcastRoom();
    this.sendGameTo(m.id);
    this.scheduleTimers();
  }

  detach(m: Member, conn: Conn) {
    const set = this.conns.get(m.id);
    set?.delete(conn);
    if (set && set.size === 0) {
      m.connected = false;
      m.lastSeen = Date.now();
      this.system(`${m.name} disconnected.`);
      if (m.id === this.hostId) this.scheduleHostTransfer();
      this.broadcastRoom();
      this.scheduleTimers();
    }
  }

  private scheduleHostTransfer() {
    if (this.hostTimer) clearTimeout(this.hostTimer);
    this.hostTimer = setTimeout(() => {
      const host = this.members.find((m) => m.id === this.hostId);
      if (host?.connected) return;
      const next = this.members.find((m) => m.connected && !m.isBot);
      if (next) {
        this.hostId = next.id;
        this.system(`${next.name} is now the host.`);
        this.broadcastRoom();
        this.touch();
      }
    }, HOST_GRACE_MS);
    this.hostTimer.unref?.();
  }

  removeMember(id: string, reason: string) {
    const m = this.members.find((x) => x.id === id);
    if (!m) return;
    this.members = this.members.filter((x) => x.id !== id);
    for (const c of this.conns.get(id) ?? []) {
      c.send({ t: 'kicked', reason });
      c.close(4000, reason);
    }
    this.conns.delete(id);
    this.system(`${m.name} ${reason === 'left' ? 'left' : 'was removed'}.`);
    if (this.hostId === id) {
      const next = this.members.find((x) => !x.isBot);
      this.hostId = next?.id ?? '';
      if (next) this.system(`${next.name} is now the host.`);
    }
    this.touch();
    if (!this.members.some((x) => !x.isBot)) this.manager.destroy(this.code);
    else this.broadcastRoom();
  }

  // ───────────── messaging ─────────────

  send(memberIdTo: string, msg: ServerMessage) {
    for (const c of this.conns.get(memberIdTo) ?? []) c.send(msg);
  }

  system(text: string) {
    const msg: ChatMessage = { id: ++this.chatSeq, from: 'system', name: 'System', text, ts: Date.now(), system: true };
    this.chat.push(msg);
    if (this.chat.length > 100) this.chat.shift();
    for (const m of this.members) this.send(m.id, { t: 'chat', msg });
  }

  roomView(forId: string): RoomView {
    return {
      code: this.code,
      phase: this.game ? 'game' : 'lobby',
      you: forId,
      hostId: this.hostId,
      members: this.members.map((m) => ({ id: m.id, name: m.name, connected: m.isBot || m.connected, ready: m.ready, isHost: m.id === this.hostId, isBot: m.isBot })),
      settings: this.settings,
      chat: this.chat.slice(-50),
      debug: this.debug,
    };
  }

  broadcastRoom() {
    for (const m of this.members) if (!m.isBot) this.send(m.id, { t: 'room', room: this.roomView(m.id) });
  }

  sendGameTo(id: string) {
    if (!this.game) return;
    const g = this.game;
    const view = viewFor(g, id);
    const d = g.pending;
    const deadline = d ? (this.deadlines.get(`${d.id}:${id}`) ?? this.minDeadline()) : null;
    const debugHost = this.debug && this.manager.opts.debugAllowed && id === this.hostId;
    this.send(id, {
      t: 'game', view, deadline, serverTime: Date.now(),
      seats: debugHost ? g.state.players.map((p) => p.id) : undefined,
      // Debug rooms only: the host may inspect/act for every seat.
      views: debugHost ? Object.fromEntries(g.state.players.map((p) => [p.id, viewFor(g, p.id)])) : undefined,
    });
  }

  private minDeadline(): number | null {
    const d = this.game?.pending;
    if (!d) return null;
    const ds = [...this.deadlines.entries()].filter(([k]) => k.startsWith(`${d.id}:`)).map(([, v]) => v);
    return ds.length ? Math.min(...ds) : null;
  }

  broadcastGame() {
    for (const m of this.members) if (!m.isBot) this.sendGameTo(m.id);
  }

  // ───────────── client messages ─────────────

  handle(m: Member, msg: ClientMessage): string | null {
    m.lastSeen = Date.now();
    const isHost = m.id === this.hostId;
    switch (msg.t) {
      case 'ping':
        this.send(m.id, { t: 'pong', ts: msg.ts, serverTime: Date.now() });
        return null;
      case 'chat': {
        const c: ChatMessage = { id: ++this.chatSeq, from: m.id, name: m.name, text: msg.text.slice(0, 300), ts: Date.now() };
        this.chat.push(c);
        if (this.chat.length > 100) this.chat.shift();
        for (const x of this.members) this.send(x.id, { t: 'chat', msg: c });
        this.touch();
        return null;
      }
      case 'ready':
        if (this.game) return 'The game has already started.';
        m.ready = msg.ready;
        this.broadcastRoom();
        this.touch();
        return null;
      case 'settings':
        if (!isHost) return 'Only the host can change settings.';
        if (this.game) return 'Settings are locked during a game.';
        this.settings = { ...this.settings, ...msg.settings };
        this.broadcastRoom();
        this.touch();
        return null;
      case 'kick': {
        if (!isHost) return 'Only the host can remove players.';
        if (this.game) return 'Players cannot be removed during a game.';
        if (msg.playerId === m.id) return 'You cannot remove yourself.';
        this.removeMember(msg.playerId, 'kicked');
        return null;
      }
      case 'addBot': {
        if (!isHost) return 'Only the host can add bots.';
        if (this.game) return 'The game has already started.';
        if (this.members.length >= MAX_PLAYERS) return 'The room is full.';
        const used = new Set(this.members.map((x) => x.name));
        this.addMember(BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${this.members.length + 1}`, true);
        this.broadcastRoom();
        return null;
      }
      case 'removeBot': {
        if (!isHost) return 'Only the host can remove bots.';
        if (this.game) return 'The game has already started.';
        const bot = [...this.members].reverse().find((x) => x.isBot);
        if (bot) this.removeMember(bot.id, 'kicked');
        return null;
      }
      case 'leave':
        if (this.game && this.game.state.status !== 'finished') {
          // During a game a leaving player is treated as disconnected (their turns time out).
          for (const c of this.conns.get(m.id) ?? []) c.close(4001, 'left');
          return null;
        }
        this.removeMember(m.id, 'left');
        return null;
      case 'start':
        if (!isHost) return 'Only the host can start the game.';
        return this.startGame();
      case 'rematch':
        if (!isHost) return 'Only the host can start a rematch.';
        if (!this.game || this.game.state.status !== 'finished') return 'The current game is not finished.';
        this.game = null;
        this.deadlines.clear();
        for (const x of this.members) x.ready = x.isBot;
        this.system('Back to the lobby for a rematch.');
        this.broadcastRoom();
        this.touch();
        return null;
      case 'pref':
        if (this.game) {
          this.game.setAutoUse(m.id, msg.autoUse);
          this.sendGameTo(m.id);
          this.touch();
        }
        return null;
      case 'answer': {
        if (!this.game) return 'No game in progress.';
        let actor = m.id;
        if (msg.as && msg.as !== m.id) {
          if (!(this.debug && isHost && this.manager.opts.debugAllowed)) return 'You cannot act for another player.';
          actor = msg.as;
        }
        if (this.game.pending?.id !== msg.decisionId) return 'That prompt has expired.';
        return this.dispatch(actor, msg.answer as Answer);
      }
      case 'debug': {
        if (!this.canDebug(m)) return 'Debug tools are disabled.';
        if (!this.game) return 'No game in progress.';
        const err = this.game.debug(msg.op as DebugAction);
        this.afterChange();
        return err;
      }
      case 'debugScenario': {
        if (!this.canDebug(m)) return 'Debug tools are disabled.';
        return this.startGame(msg.scenario as Scenario);
      }
      case 'debugState': {
        if (!this.canDebug(m)) return 'Debug tools are disabled.';
        if (!this.game) return 'No game in progress.';
        this.send(m.id, { t: 'debugState', state: { state: this.game.state, pending: this.game.pending, commands: this.game.commands.length } });
        return null;
      }
    }
    return null;
  }

  private canDebug(m: Member) {
    return this.debug && this.manager.opts.debugAllowed && m.id === this.hostId;
  }

  startGame(scenario?: Scenario): string | null {
    if (this.game && this.game.state.status !== 'finished') return 'A game is already in progress.';
    const players = this.members;
    if (players.length < MIN_PLAYERS) return `At least ${MIN_PLAYERS} players are needed (add bots to fill seats).`;
    if (players.length > MAX_PLAYERS) return `At most ${MAX_PLAYERS} players.`;
    if (!scenario && players.some((p) => !p.ready && p.id !== this.hostId)) return 'Waiting for everyone to be ready.';
    const config: GameConfig = {
      playerIds: players.map((p) => p.id),
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      seed: secureSeed(),
      roleVariant: this.settings.roleVariant,
      includeEx: this.settings.includeEx,
      generalChoices: this.settings.generalChoices,
      bots: players.filter((p) => p.isBot).map((p) => p.id),
      scenario,
    };
    try {
      this.game = new Game(config);
    } catch (e) {
      this.game = null;
      return `Could not start: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.deadlines.clear();
    this.system(scenario ? 'Debug scenario started.' : 'The game has started!');
    this.broadcastRoom();
    this.afterChange();
    return null;
  }

  dispatch(actor: string, answer: Answer): string | null {
    const g = this.game!;
    let err: string | null;
    try {
      err = g.dispatch(actor, answer);
    } catch (e) {
      console.error(`[room ${this.code}] engine error`, e);
      this.system('An internal rules error occurred; the game was paused. Please report it.');
      return 'Internal error.';
    }
    if (!err) this.afterChange();
    return err;
  }

  /** After every state change: timers, bots, broadcast, persist. */
  afterChange() {
    this.scheduleTimers();
    this.scheduleBots();
    this.broadcastGame();
    this.touch();
  }

  // ───────────── timers & bots ─────────────

  private timeoutFor(kind: string, timeout: string): number {
    if (timeout === 'select') return SELECT_MS;
    const s = timeout === 'play' ? this.settings.turnSeconds : this.settings.responseSeconds;
    void kind;
    return s > 0 ? s * 1000 : 0;
  }

  scheduleTimers() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const g = this.game;
    const d = g?.pending;
    if (!g || !d) return;
    const now = Date.now();
    for (const pid of g.waitingOn()) {
      const key = `${d.id}:${pid}`;
      const m = this.members.find((x) => x.id === pid);
      if (!m || m.isBot) continue;
      const base = this.timeoutFor(d.kind, d.timeout);
      let dl = this.deadlines.get(key);
      if (dl === undefined && base > 0) dl = now + base;
      if (!m.connected) dl = Math.min(dl ?? Infinity, now + DISCONNECTED_DECISION_MS);
      if (dl !== undefined && Number.isFinite(dl)) this.deadlines.set(key, dl);
    }
    // drop deadlines of old decisions
    for (const k of this.deadlines.keys()) if (!k.startsWith(`${d.id}:`)) this.deadlines.delete(k);
    const next = this.minDeadline();
    if (next === null) return;
    this.timer = setTimeout(() => this.fireTimeouts(), Math.max(0, next - Date.now()) + 50);
    this.timer.unref?.();
  }

  private fireTimeouts() {
    const g = this.game;
    const d = g?.pending;
    if (!g || !d) return;
    const now = Date.now();
    let changed = false;
    for (const pid of g.waitingOn()) {
      const dl = this.deadlines.get(`${d.id}:${pid}`);
      if (dl !== undefined && dl <= now && g.pending?.id === d.id) {
        const err = g.dispatch(pid, { type: 'timeout' });
        if (!err) changed = true;
      }
    }
    if (changed) this.afterChange();
    else this.scheduleTimers();
  }

  private scheduleBots() {
    if (this.botTimer) return;
    const g = this.game;
    if (!g?.pending) return;
    const bots = g.waitingOn().filter((pid) => this.members.find((m) => m.id === pid)?.isBot);
    if (!bots.length) return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      const game = this.game;
      if (!game?.pending) return;
      let acted = false;
      for (const pid of game.waitingOn()) {
        if (!this.members.find((m) => m.id === pid)?.isBot) continue;
        const ans = botAnswer(game, pid, this.botRng);
        const err = game.dispatch(pid, ans);
        if (err) game.dispatch(pid, { type: 'timeout' });
        acted = true;
        break;
      }
      if (acted) this.afterChange();
    }, this.manager.opts.botDelayMs);
    this.botTimer.unref?.();
  }

  // ───────────── persistence ─────────────

  touch() {
    this.updatedAt = Date.now();
    this.manager.persist(this);
  }

  toSaved(): SavedRoom {
    return {
      code: this.code,
      hostId: this.hostId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      debug: this.debug,
      members: this.members.map(({ id, name, token: t, ready, isBot }) => ({ id, name, token: t, ready, isBot })),
      settings: this.settings,
      chat: this.chat.slice(-50),
      game: this.game ? { config: this.game.config, commands: this.game.commands.map(({ player, answer }) => ({ player, answer })) } : null,
    };
  }

  static fromSaved(s: SavedRoom, manager: RoomManager): Room {
    const r = new Room(s.code, manager, s.debug);
    r.hostId = s.hostId;
    r.createdAt = s.createdAt;
    r.updatedAt = s.updatedAt;
    r.members = s.members.map((m) => ({ ...m, connected: false, lastSeen: Date.now() }));
    r.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    r.chat = s.chat;
    r.chatSeq = Math.max(0, ...s.chat.map((c) => c.id));
    if (s.game) r.game = engine.replay(s.game.config, s.game.commands);
    return r;
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.hostTimer) clearTimeout(this.hostTimer);
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();
  private saveTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private store: RoomStore,
    public opts: RoomOptions = { debugAllowed: false, botDelayMs: 900 },
  ) {}

  async restore() {
    const saved = await this.store.loadAll();
    for (const s of saved) {
      if (Date.now() - s.updatedAt > ROOM_TTL_MS) {
        await this.store.remove(s.code);
        continue;
      }
      try {
        const r = Room.fromSaved(s, this);
        this.rooms.set(r.code, r);
        r.scheduleTimers();
      } catch (e) {
        console.warn(`[rooms] could not restore room ${s.code}:`, e);
      }
    }
    return this.rooms.size;
  }

  create(hostName: string, debug = false): { room: Room; member: Member } {
    let code = makeCode();
    while (this.rooms.has(code)) code = makeCode();
    const room = new Room(code, this, debug && this.opts.debugAllowed);
    this.rooms.set(code, room);
    const member = room.addMember(hostName);
    return { room, member };
  }

  join(code: string, name: string): { room: Room; member: Member } | string {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return 'Room not found. Check the code or ask the host for a new link.';
    if (room.game && room.game.state.status !== 'finished') return 'This game is already in progress.';
    if (room.members.length >= MAX_PLAYERS) return 'The room is full (8 players).';
    const member = room.addMember(name);
    room.broadcastRoom();
    return { room, member };
  }

  get(code: string) {
    return this.rooms.get(code.toUpperCase());
  }

  destroy(code: string) {
    const r = this.rooms.get(code);
    r?.dispose();
    this.rooms.delete(code);
    const t = this.saveTimers.get(code);
    if (t) clearTimeout(t);
    this.saveTimers.delete(code);
    void this.store.remove(code);
  }

  persist(room: Room) {
    if (this.saveTimers.has(room.code)) return;
    const t = setTimeout(() => {
      this.saveTimers.delete(room.code);
      if (!this.rooms.has(room.code)) return;
      this.store.save(room.toSaved()).catch((e) => console.warn('[rooms] save failed', e));
    }, 300);
    t.unref?.();
    this.saveTimers.set(room.code, t);
  }

  async flush() {
    for (const [code, t] of this.saveTimers) {
      clearTimeout(t);
      const r = this.rooms.get(code);
      if (r) await this.store.save(r.toSaved());
    }
    this.saveTimers.clear();
  }

  /** Remove long-idle rooms. */
  sweep() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      const anyone = r.members.some((m) => m.connected);
      if (!anyone && now - r.updatedAt > ROOM_TTL_MS) this.destroy(r.code);
    }
  }
}
