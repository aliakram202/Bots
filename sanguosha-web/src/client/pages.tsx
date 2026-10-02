import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_PLAYERS, type ChatMessage } from '../shared/protocol';
import { ROLE_INFO } from '../game/rules/roles';
import { GENERALS } from '../game/generals/definitions';
import type { GameView } from '../game/engine/view';
import { api, clearSession, lastName, loadSession, net, saveSession, useNet, type NetState, type Session } from './net';
import { Rulebook } from './components/Rulebook';
import { genName, RoleBadge } from './components/info';
import { Portrait } from './components/Portrait';
import { Table } from './game/Table';
import { setSoundEnabled, soundEnabled } from './sound';

export function navigate(path: string) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// ───────────── Home ─────────────

export function Home({ debugAllowed }: { debugAllowed: boolean }) {
  const [name, setName] = useState(lastName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const [debug, setDebug] = useState(false);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ code: string; playerId: string; token: string }>('/api/rooms', { name, debug });
      saveSession({ code: r.code, playerId: r.playerId, token: r.token, name });
      navigate(`/room/${r.code}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const join = () => {
    const c = code.trim().toUpperCase().replace(/.*\/ROOM\//, '');
    if (c) navigate(`/room/${c}`);
  };

  return (
    <div className="home">
      <div className="home-card panel">
        <div className="brand">
          <div className="seal">杀</div>
          <h1>Three Kingdoms Table</h1>
          <p>A San Guo Sha compatible private game simulator</p>
        </div>
        <div className="col">
          <label className="tiny muted" htmlFor="name">Your display name</label>
          <input id="name" className="input" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kongming" data-testid="name-input"
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && create()} />
          <button className="btn primary" disabled={!name.trim() || busy} onClick={create} data-testid="create-room">
            Create Room
          </button>
          {debugAllowed && (
            <label className="row tiny muted">
              <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Developer debug room
            </label>
          )}
        </div>
        <div className="divider">or join with a code</div>
        <div className="row">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Room code or link" maxLength={80} onKeyDown={(e) => e.key === 'Enter' && join()} data-testid="code-input" />
          <button className="btn" onClick={join} disabled={!code.trim()}>Join</button>
        </div>
        {err && <div className="banner-warn" style={{ marginTop: 12 }}>{err}</div>}
        <div className="home-foot">
          No accounts needed — share the room link with friends. <button onClick={() => setRules(true)}>Rules & About</button>
        </div>
      </div>
      {rules && <Rulebook onClose={() => setRules(false)} />}
    </div>
  );
}

// ───────────── Room page ─────────────

export function RoomPage({ code }: { code: string }) {
  const [session, setSession] = useState<Session | null>(() => loadSession(code));
  const ns = useNet();
  useEffect(() => {
    if (session) net.connect(session);
    return () => net.disconnect();
  }, [session]);

  if (!session) return <JoinForm code={code} onJoined={setSession} />;
  if (ns.kicked) {
    return (
      <div className="home">
        <div className="home-card panel">
          <h2>You left the room</h2>
          <p className="muted">{ns.kicked === 'kicked' ? 'The host removed you from the room.' : 'You are no longer in this room.'}</p>
          <button className="btn primary" onClick={() => navigate('/')}>Back home</button>
        </div>
      </div>
    );
  }
  if (ns.status === 'closed' && !ns.room) {
    return (
      <div className="home">
        <div className="home-card panel">
          <h2>Can’t enter this room</h2>
          <p className="muted">{ns.errors[0]?.text ?? 'The room may have expired or your session is no longer valid.'}</p>
          <div className="row">
            <button className="btn" onClick={() => { clearSession(code); setSession(null); }}>Join again</button>
            <button className="btn primary" onClick={() => navigate('/')}>Home</button>
          </div>
        </div>
      </div>
    );
  }
  return <RoomShell ns={ns} />;
}

function JoinForm({ code, onJoined }: { code: string; onJoined(s: Session): void }) {
  const [name, setName] = useState(lastName());
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<{ exists: boolean; phase?: string; players?: number } | null>(null);
  useEffect(() => {
    api<{ exists: boolean; phase: string; players: number }>(`/api/rooms/${code}`).then(setInfo).catch(() => setInfo({ exists: false }));
  }, [code]);
  const join = async () => {
    setErr(null);
    try {
      const r = await api<{ code: string; playerId: string; token: string }>(`/api/rooms/${code}/join`, { name });
      const s = { code: r.code, playerId: r.playerId, token: r.token, name };
      saveSession(s);
      onJoined(s);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="home">
      <div className="home-card panel">
        <div className="brand">
          <div className="seal">杀</div>
          <h1>Join room {code}</h1>
          <p>{info === null ? 'Checking room…' : !info.exists ? 'This room does not exist (anymore).' : `${info.players}/${MAX_PLAYERS} players · ${info.phase === 'game' ? 'game in progress' : 'waiting in lobby'}`}</p>
        </div>
        {info?.exists && (
          <div className="col">
            <input className="input" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your display name" data-testid="name-input"
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && join()} />
            <button className="btn primary" disabled={!name.trim()} onClick={join} data-testid="join-room">Join</button>
          </div>
        )}
        {err && <div className="banner-warn" style={{ marginTop: 12 }}>{err}</div>}
        <div className="home-foot"><button onClick={() => navigate('/')}>Back home</button></div>
      </div>
    </div>
  );
}

function RoomShell({ ns }: { ns: NetState }) {
  const [rules, setRules] = useState(false);
  const [sound, setSound] = useState(soundEnabled());
  const [side, setSide] = useState(false);
  const room = ns.room;
  return (
    <>
      <header className="topbar">
        <span className="title">Three Kingdoms Table</span>
        {room && <span className="code" title="Room code">{room.code}</span>}
        <span className={`conn-dot ${ns.status === 'open' ? '' : 'bad'}`} title={ns.status === 'open' ? `Connected${ns.latency !== null ? ` · ${ns.latency} ms` : ''}` : 'Reconnecting…'} />
        {ns.status !== 'open' && <span className="tiny muted">{ns.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</span>}
        <span className="grow" />
        {room?.phase === 'game' && (
          <button className="btn small ghost" onClick={() => setSide(!side)} style={{ display: 'none' }} id="side-toggle">Log</button>
        )}
        <button className="btn small ghost" onClick={() => { setSoundEnabled(!sound); setSound(!sound); }} title="Toggle sound">{sound ? '🔊' : '🔇'}</button>
        <button className="btn small" onClick={() => setRules(true)} data-testid="open-rules">Rules</button>
        <button className="btn small ghost" onClick={() => { if (confirm('Leave this room?')) { net.send({ t: 'leave' }); clearSession(room?.code ?? ''); navigate('/'); } }}>Leave</button>
      </header>
      {!room ? (
        <div className="home"><div className="muted">Connecting to room…</div></div>
      ) : room.phase === 'lobby' || !ns.game ? (
        <Lobby ns={ns} />
      ) : (
        <div className="game">
          <Table net={ns} />
          <Sidebar ns={ns} open={side} />
          {ns.game.status === 'finished' && <GameOver view={ns.game} isHost={room.hostId === room.you} />}
        </div>
      )}
      <div className="toasts">
        {ns.errors.map((e) => (
          <div key={e.id} className="toast">{e.text}</div>
        ))}
      </div>
      {rules && <Rulebook onClose={() => setRules(false)} />}
      {room?.debug && room.hostId === room.you && <DebugPanel ns={ns} />}
    </>
  );
}

// ───────────── Lobby ─────────────

function Lobby({ ns }: { ns: NetState }) {
  const room = ns.room!;
  const me = room.members.find((m) => m.id === room.you);
  const isHost = room.hostId === room.you;
  const link = `${location.origin}/room/${room.code}`;
  const [copied, setCopied] = useState(false);
  const s = room.settings;
  const set = (patch: Partial<typeof s>) => net.send({ t: 'settings', settings: patch });
  const notReady = room.members.filter((m) => !m.ready && m.id !== room.hostId);
  const n = room.members.length;
  return (
    <div className="lobby">
      <div className="lobby-main">
        <div className="panel share">
          <div>
            <div className="tiny muted">Room code</div>
            <div className="big-code" data-testid="room-code">{room.code}</div>
          </div>
          <div className="link col">
            <div className="tiny muted">Invite link — send this to your friends</div>
            <div className="row">
              <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} data-testid="invite-link" />
              <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
        <div className="panel members">
          <h3 className="section-title">Players {n}/{MAX_PLAYERS}</h3>
          <div className="member-grid">
            {room.members.map((m) => (
              <div key={m.id} className="member" data-testid={`member-${m.name}`}>
                <div className="name">
                  <span className={`conn-dot ${m.connected ? '' : 'bad'}`} /> {m.name} {m.id === room.you && <span className="chip">you</span>}
                </div>
                <div className="row tiny">
                  {m.isHost && <span className="chip" style={{ color: 'var(--bronze-2)' }}>Host</span>}
                  {m.isBot && <span className="chip">Bot</span>}
                  {!m.isHost && <span className="chip" style={{ color: m.ready ? 'var(--green)' : 'var(--ink-mute)' }}>{m.ready ? 'Ready' : 'Not ready'}</span>}
                </div>
                {isHost && m.id !== room.you && (
                  <button className="btn small ghost x" title="Remove" onClick={() => net.send({ t: 'kick', playerId: m.id })}>✕</button>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - n) }, (_, i) => (
              <div key={i} className="member empty">Waiting for player…</div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            {!isHost && me && (
              <button className={`btn ${me.ready ? '' : 'primary'}`} onClick={() => net.send({ t: 'ready', ready: !me.ready })} data-testid="ready">
                {me.ready ? 'Not ready' : "I'm ready"}
              </button>
            )}
            {isHost && (
              <>
                <button className="btn primary" disabled={n < 2 || notReady.length > 0} onClick={() => net.send({ t: 'start' })} data-testid="start-game">
                  Start game ({n} players)
                </button>
                <button className="btn" disabled={n >= MAX_PLAYERS} onClick={() => net.send({ t: 'addBot' })} data-testid="add-bot">+ Add bot</button>
                <button className="btn ghost" disabled={!room.members.some((m) => m.isBot)} onClick={() => net.send({ t: 'removeBot' })}>− Remove bot</button>
              </>
            )}
            <span className="tiny muted">
              {n < 5 ? 'Identity mode plays best with 5–8 players. Add bots to fill seats. ' : ''}
              {notReady.length > 0 ? `Waiting for: ${notReady.map((m) => m.name).join(', ')}` : ''}
            </span>
          </div>
        </div>
        <div className="panel">
          <h3 className="section-title" style={{ padding: '16px 16px 0' }}>Match settings {isHost ? '' : <span className="tiny muted">(host only)</span>}</h3>
          <div className="settings">
            <label>
              Role distribution
              <select className="input" disabled={!isHost} value={s.roleVariant} onChange={(e) => set({ roleVariant: e.target.value as 'standard' })}>
                <option value="standard">Standard (1 Renegade)</option>
                <option value="doubleRenegade">Two Renegades (6 & 8 players)</option>
              </select>
            </label>
            <label>
              EX cards (Frost Blade, Renwang Shield, ♥Q Lightning, ♦Q Negate)
              <select className="input" disabled={!isHost} value={s.includeEx ? 'yes' : 'no'} onChange={(e) => set({ includeEx: e.target.value === 'yes' })}>
                <option value="yes">Include (108 cards)</option>
                <option value="no">Exclude (104 cards)</option>
              </select>
            </label>
            <label>
              Play-phase timer
              <select className="input" disabled={!isHost} value={s.turnSeconds} onChange={(e) => set({ turnSeconds: Number(e.target.value) })}>
                {[0, 45, 60, 90, 120, 180].map((x) => <option key={x} value={x}>{x ? `${x} s` : 'Off'}</option>)}
              </select>
            </label>
            <label>
              Response timer
              <select className="input" disabled={!isHost} value={s.responseSeconds} onChange={(e) => set({ responseSeconds: Number(e.target.value) })}>
                {[0, 15, 25, 40, 60].map((x) => <option key={x} value={x}>{x ? `${x} s` : 'Off'}</option>)}
              </select>
            </label>
            <label>
              Generals offered to each player
              <select className="input" disabled={!isHost} value={s.generalChoices} onChange={(e) => set({ generalChoices: Number(e.target.value) })}>
                {[2, 3, 4, 5].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          </div>
          <p className="tiny muted" style={{ padding: '0 16px 16px', margin: 0 }}>
            Roles: {[5, 6, 7, 8].map((k) => `${k}p ${k === 5 ? '1/1/2/1' : k === 6 ? '1/1/3/1' : k === 7 ? '1/2/3/1' : '1/2/4/1'}`).join(' · ')} (Lord/Loyalist/Rebel/Renegade). The Lord gets +1 max HP with 5+ players.
          </p>
        </div>
      </div>
      <div className="lobby-side">
        <div className="panel" style={{ padding: 16, flex: 1, minHeight: 280, display: 'flex', flexDirection: 'column' }}>
          <h3 className="section-title">Chat</h3>
          <Chat messages={ns.chat} />
        </div>
      </div>
    </div>
  );
}

function Chat({ messages }: { messages: ChatMessage[] }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [messages.length]);
  return (
    <div className="chat">
      <div className="chat-list" ref={ref}>
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.system ? 'sys' : ''}`}>
            {m.system ? m.text : (<><b>{m.name}:</b> {m.text}</>)}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { net.send({ t: 'chat', text: text.trim() }); setText(''); } }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something…" maxLength={300} data-testid="chat-input" />
        <button className="btn">Send</button>
      </form>
    </div>
  );
}

// ───────────── Sidebar ─────────────

function Sidebar({ ns, open }: { ns: NetState; open: boolean }) {
  const [tab, setTab] = useState<'log' | 'chat' | 'players'>('log');
  const [tech, setTech] = useState(false);
  const view = ns.game!;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [view.log.length, tab]);
  return (
    <aside className={`sidebar ${open ? 'mobile-open' : ''}`}>
      <div className="tabs">
        <button className={`tab ${tab === 'log' ? 'on' : ''}`} onClick={() => setTab('log')}>Game log</button>
        <button className={`tab ${tab === 'chat' ? 'on' : ''}`} onClick={() => setTab('chat')}>Chat</button>
        <button className={`tab ${tab === 'players' ? 'on' : ''}`} onClick={() => setTab('players')}>Players</button>
      </div>
      <div className="side-body">
        {tab === 'log' && (
          <>
            <div className="log" ref={ref} data-testid="game-log">
              {view.log.map((e) => (
                <div key={e.id} className={`log-entry ${e.type} ${e.private ? 'private' : ''}`}>
                  {e.private ? '🔒 ' : ''}
                  {e.text}
                  {tech && <span className="tech">#{e.id} {e.type}{e.detail ? ' ' + JSON.stringify(e.detail) : ''}{e.cards ? ` cards=${e.cards.join(',')}` : ''}</span>}
                </div>
              ))}
            </div>
            <label className="row tiny muted" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={tech} onChange={(e) => setTech(e.target.checked)} /> Show technical detail
            </label>
          </>
        )}
        {tab === 'chat' && <Chat messages={ns.chat} />}
        {tab === 'players' && (
          <div className="col scroll">
            {view.players.map((p) => (
              <div key={p.id} className="row" style={{ padding: 6, borderRadius: 8, background: 'var(--panel-2)' }}>
                <Portrait general={p.general} w={30} h={38} dead={!p.alive} />
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{genName(p.general, p.name)}</div>
                  <div className="tiny muted">{p.name} · seat {p.seat + 1}</div>
                </div>
                <RoleBadge role={p.role} />
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

// ───────────── Game over ─────────────

function GameOver({ view, isHost }: { view: GameView; isHost: boolean }) {
  const w = view.winner;
  const [hidden, setHidden] = useState(false);
  const deaths = useMemo(() => view.log.filter((e) => e.type === 'death' || e.type === 'gameOver'), [view.log]);
  if (!w || hidden) {
    return hidden ? <button className="btn primary" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 40 }} onClick={() => setHidden(false)}>Show results</button> : null;
  }
  const meWon = view.viewer ? w.winners.includes(view.viewer) : false;
  const sideName = w.side === 'lord' ? 'Lord & Loyalists' : w.side === 'rebel' ? 'Rebels' : w.side === 'renegade' ? 'Renegade' : 'Nobody (draw)';
  return (
    <div className="modal-back">
      <div className="modal panel result" data-testid="game-over">
        <h2>{meWon ? 'Victory!' : w.side === 'draw' ? 'Draw' : 'Defeat'}</h2>
        <div style={{ fontSize: 18 }}>
          <b style={{ color: 'var(--bronze-2)' }}>{sideName}</b> win.
        </div>
        <p className="muted">{w.reason}</p>
        <div className="result-grid">
          {view.players.map((p) => (
            <div key={p.id} className={`result-player ${w.winners.includes(p.id) ? 'win' : ''}`}>
              <Portrait general={p.general} w={40} h={50} dead={!p.alive} />
              <div className="col" style={{ gap: 2 }}>
                <b>{genName(p.general, p.name)}</b>
                <span className="tiny muted">{p.name}</span>
                <RoleBadge role={p.role} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'left' }}>
          <h3 className="section-title" style={{ fontSize: 18 }}>Timeline</h3>
          {deaths.map((e) => (
            <div key={e.id} className="tiny" style={{ marginBottom: 3 }}>{e.text}</div>
          ))}
          <div className="tiny muted">Roles: {view.players.map((p) => `${p.name} — ${p.role ? ROLE_INFO[p.role].en : '?'}`).join(' · ')}</div>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          {isHost ? (
            <button className="btn primary" onClick={() => net.send({ t: 'rematch' })} data-testid="rematch">Back to lobby (rematch)</button>
          ) : (
            <span className="muted tiny">Waiting for the host to start a rematch…</span>
          )}
          <button className="btn ghost" onClick={() => setHidden(true)}>View table</button>
        </div>
      </div>
    </div>
  );
}

// ───────────── Debug panel (debug rooms only) ─────────────

const PRESETS: Record<string, unknown> = {
  'Lu Bu vs Zhao Yun (Wushuang)': {
    roles: { $0: 'lord', $1: 'rebel' }, generals: { $0: 'lubu', $1: 'zhaoyun' },
    hands: { $0: ['slash', 'duel'], $1: ['dodge', 'dodge', 'slash'] }, startPlayer: '$0',
  },
  'Lightning + Guicai': {
    roles: { $0: 'lord', $1: 'rebel' }, generals: { $0: 'caocao', $1: 'simayi' },
    judges: { $0: ['lightning'] }, hands: { $1: ['peach', 'slash'] }, startPlayer: '$0',
  },
  'Dying rescue (Hua Tuo)': {
    roles: { $0: 'rebel', $1: 'lord', $2: 'loyalist' }, generals: { $0: 'zhangfei', $1: 'liubei', $2: 'huatuo' },
    hp: { $1: 1 }, hands: { $0: ['slash', 'slash'], $2: ['dodge'] }, deckTop: ['jueying', 'dilu'], startPlayer: '$0',
  },
};

function DebugPanel({ ns }: { ns: NetState }) {
  const room = ns.room!;
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(Object.keys(PRESETS)[0]);
  const [json, setJson] = useState('');
  const [player, setPlayer] = useState('');
  const [card, setCard] = useState('slash');
  const ids = room.members.map((m) => m.id);
  const fill = (o: unknown) => JSON.parse(JSON.stringify(o).replace(/\$(\d)/g, (_, i) => ids[Number(i)] ?? `missing${i}`));
  if (!open) return <button className="btn small" style={{ position: 'fixed', left: 270, top: 58, zIndex: 70 }} onClick={() => setOpen(true)}>Debug tools</button>;
  const op = (o: object) => net.send({ t: 'debug', op: o as never });
  const players = ns.game?.players ?? [];
  return (
    <div className="debug-panel panel">
      <div className="row"><b>Debug tools</b><span className="grow" /><button className="btn small" onClick={() => setOpen(false)}>✕</button></div>
      <p className="tiny muted">Debug rooms only (server started with ENABLE_DEBUG=1). Scenario seats: $0 = first member, $1 = second…</p>
      <select className="input" value={preset} onChange={(e) => { setPreset(e.target.value); setJson(JSON.stringify(fill(PRESETS[e.target.value]), null, 1)); }}>
        {Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}
      </select>
      <textarea className="input" value={json || JSON.stringify(fill(PRESETS[preset]), null, 1)} onChange={(e) => setJson(e.target.value)} />
      <button className="btn small primary" onClick={() => { try { net.send({ t: 'debugScenario', scenario: JSON.parse(json || JSON.stringify(fill(PRESETS[preset]))) }); } catch (e) { net.pushError(String(e)); } }}>Start scenario</button>
      {ns.game && (
        <div className="col" style={{ marginTop: 10 }}>
          <select className="input" value={player} onChange={(e) => setPlayer(e.target.value)}>
            <option value="">— player —</option>
            {players.map((p) => <option key={p.id} value={p.id}>{genName(p.general, p.name)} ({p.name})</option>)}
          </select>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 120 }} value={card} onChange={(e) => setCard(e.target.value)} placeholder="card id (slash…)" />
            <button className="btn small" onClick={() => op({ action: 'give', player, card })}>Give</button>
            <button className="btn small" onClick={() => op({ action: 'equip', player, card })}>Equip</button>
            <button className="btn small" onClick={() => op({ action: 'deckTop', card })}>Deck top</button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn small" onClick={() => op({ action: 'judge', player, card: 'indulgence' })}>+Indulgence</button>
            <button className="btn small" onClick={() => op({ action: 'judge', player, card: 'lightning' })}>+Lightning</button>
            <button className="btn small" onClick={() => op({ action: 'setHp', player, hp: 1 })}>HP 1</button>
            <button className="btn small" onClick={() => op({ action: 'setHp', player, hp: 99 })}>Full HP</button>
            <button className="btn small" onClick={() => op({ action: 'kill', player })}>Kill</button>
            <button className="btn small" onClick={() => op({ action: 'revive', player })}>Revive</button>
            <button className="btn small" onClick={() => op({ action: 'peek' })}>Peek deck</button>
            <button className="btn small" onClick={() => net.send({ t: 'debugState' })}>Server state</button>
          </div>
          {ns.debugState != null && <textarea className="input" readOnly value={JSON.stringify(ns.debugState, null, 1).slice(0, 20000)} />}
        </div>
      )}
      <p className="tiny muted">Generals: {GENERALS.map((g) => g.id).join(', ')}</p>
    </div>
  );
}
