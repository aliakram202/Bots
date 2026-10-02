import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomManager, type Conn } from './rooms';
import { MemoryRoomStore } from './store';
import type { ServerMessage } from '../shared/protocol';
import { viewFor } from '../game/engine/view';

function fakeConn() {
  const msgs: ServerMessage[] = [];
  const conn: Conn & { msgs: ServerMessage[]; closed: boolean } = {
    msgs,
    closed: false,
    send: (m) => msgs.push(structuredClone(m)),
    close() {
      this.closed = true;
    },
  };
  return conn;
}
const lastGame = (c: ReturnType<typeof fakeConn>) => [...c.msgs].reverse().find((m) => m.t === 'game') as Extract<ServerMessage, { t: 'game' }> | undefined;

describe('rooms', () => {
  afterEach(() => vi.useRealTimers());

  it('create → join → bots → start; every client only sees its own hand and role', async () => {
    const mgr = new RoomManager(new MemoryRoomStore(), { debugAllowed: false, botDelayMs: 0 });
    const { room, member: host } = mgr.create('Alice');
    const j = mgr.join(room.code, 'Bob');
    if (typeof j === 'string') throw new Error(j);
    const bob = j.member;
    const ca = fakeConn();
    const cb = fakeConn();
    room.attach(host, ca);
    room.attach(bob, cb);
    expect(room.handle(host, { t: 'start' })).toMatch(/ready/);
    room.handle(bob, { t: 'ready', ready: true });
    room.handle(host, { t: 'addBot' });
    room.handle(host, { t: 'addBot' });
    room.handle(host, { t: 'addBot' });
    expect(room.handle(host, { t: 'start' })).toBeNull();
    const va = lastGame(ca)!.view;
    const vb = lastGame(cb)!.view;
    // Each view contains only the viewer's own role (or the public Lord) and no other hands.
    for (const [v, me] of [[va, host.id], [vb, bob.id]] as const) {
      for (const p of v.players) {
        if (p.id !== me) {
          expect(p.hand).toBeUndefined();
          if (p.id !== v.lord) expect(p.role).toBeNull();
        }
      }
      expect(v.players.find((p) => p.id === me)!.role).not.toBeNull();
    }
    // Raw JSON sent to Bob must not contain Alice's hand card ids as a hand list.
    const realA = room.game!.player(host.id);
    expect(JSON.stringify(vb.players.find((p) => p.id === host.id))).not.toContain('"hand"');
    expect(realA.role).toBeTruthy();
  });

  it('rejects answers to stale prompts and actions for other players', () => {
    const mgr = new RoomManager(new MemoryRoomStore(), { debugAllowed: false, botDelayMs: 0 });
    const { room, member: host } = mgr.create('Alice');
    room.handle(host, { t: 'addBot' });
    room.handle(host, { t: 'start' });
    const d = room.game!.pending!;
    expect(room.handle(host, { t: 'answer', decisionId: d.id + 99, answer: { type: 'pass' } })).toMatch(/expired/);
    const other = room.members.find((m) => m.id !== host.id)!;
    expect(room.handle(host, { t: 'answer', decisionId: d.id, answer: { type: 'pass' }, as: other.id })).toMatch(/another player/);
  });

  it('reconnect resends the current private view', () => {
    const mgr = new RoomManager(new MemoryRoomStore(), { debugAllowed: false, botDelayMs: 0 });
    const { room, member: host } = mgr.create('Alice');
    room.handle(host, { t: 'addBot' });
    const c1 = fakeConn();
    room.attach(host, c1);
    room.handle(host, { t: 'start' });
    room.detach(host, c1);
    expect(room.members.find((m) => m.id === host.id)!.connected).toBe(false);
    const c2 = fakeConn();
    room.attach(host, c2);
    const v = lastGame(c2)!.view;
    expect(v.viewer).toBe(host.id);
    expect(v).toEqual(viewFor(room.game!, host.id));
  });

  it('persists and restores an in-progress game by replay', async () => {
    const store = new MemoryRoomStore();
    const mgr = new RoomManager(store, { debugAllowed: false, botDelayMs: 0 });
    const { room, member: host } = mgr.create('Alice');
    for (let i = 0; i < 4; i++) room.handle(host, { t: 'addBot' });
    room.handle(host, { t: 'start' });
    // answer the general choice for the human if needed
    const g = room.game!;
    while (g.pending && g.waitingOn().includes(host.id) && g.pending.kind === 'chooseGeneral') {
      room.handle(host, { t: 'answer', decisionId: g.pending.id, answer: { type: 'general', general: (g.pending as any).options[host.id][0] } });
    }
    await mgr.flush();
    const saved = (await store.loadAll())[0];
    const mgr2 = new RoomManager(store, { debugAllowed: false, botDelayMs: 0 });
    await mgr2.restore();
    const restored = mgr2.get(room.code)!;
    expect(restored.game!.state.players.map((p) => [p.general, p.hp, p.hand])).toEqual(g.state.players.map((p) => [p.general, p.hp, p.hand]));
    expect(saved.members.find((m) => m.id === host.id)!.token).toBe(host.token);
  });

  it('times out a disconnected player\'s decision', () => {
    vi.useFakeTimers();
    const mgr = new RoomManager(new MemoryRoomStore(), { debugAllowed: false, botDelayMs: 0 });
    const { room, member: host } = mgr.create('Alice');
    const j = mgr.join(room.code, 'Bob');
    if (typeof j === 'string') throw new Error(j);
    room.handle(j.member, { t: 'ready', ready: true });
    room.handle(host, { t: 'start' });
    const before = room.game!.pending!.id;
    vi.advanceTimersByTime(25_000);
    expect(room.game!.pending!.id).not.toBe(before);
  });

  it('kick and host-only controls', () => {
    const mgr = new RoomManager(new MemoryRoomStore(), { debugAllowed: false, botDelayMs: 0 });
    const { room, member: host } = mgr.create('Alice');
    const j = mgr.join(room.code, 'Bob');
    if (typeof j === 'string') throw new Error(j);
    expect(room.handle(j.member, { t: 'kick', playerId: host.id })).toMatch(/host/);
    expect(room.handle(host, { t: 'kick', playerId: j.member.id })).toBeNull();
    expect(room.members).toHaveLength(1);
  });
});
