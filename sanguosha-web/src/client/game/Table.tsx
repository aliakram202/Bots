import { useEffect, useMemo, useRef, useState } from 'react';
import { getCard } from '../../game/cards/deck';
import { CARD_DEFS } from '../../game/cards/definitions';
import { GENERALS_BY_ID } from '../../game/generals/definitions';
import { SKILLS_BY_ID } from '../../game/skills/definitions';
import type { EquipSlot } from '../../game/engine/types';
import type { GameView, PublicPlayer, ViewLogEntry } from '../../game/engine/view';
import { net, type NetState } from '../net';
import { CardTip, CardView } from '../components/CardView';
import { Emblem, genName, genZh, Hp, RoleBadge, SkillTip } from '../components/info';
import { Portrait } from '../components/Portrait';
import { tipProps } from '../components/Tooltip';
import { useController, type Controller } from './controller';
import { useFx } from './fx';
import { GeneralSelect, GuanxingModal, HarvestModal, PickCardModal, YijiModal } from './Modals';
import { JudgeIcons, Seat, SLOT_ICON, SLOT_ORDER } from './Seat';

const PHASE_LABEL: Record<string, string> = { start: 'Start', judgment: 'Judge', draw: 'Draw', play: 'Play', discard: 'Discard', end: 'End' };
const PHASE_ZH: Record<string, string> = { start: '准备', judgment: '判定', draw: '摸牌', play: '出牌', discard: '弃牌', end: '结束' };

/** Client-side distance (public info only) — mirrors rules/distance.ts for display. */
function displayDistance(view: GameView, from: PublicPlayer, to: PublicPlayer): number {
  const alive = view.players.filter((p) => p.alive || p.id === from.id || p.id === to.id);
  const i = alive.findIndex((p) => p.id === from.id);
  const j = alive.findIndex((p) => p.id === to.id);
  const n = alive.length;
  const cw = (j - i + n) % n;
  let d = Math.min(cw, n - cw);
  if (to.equip.horsePlus) d += 1;
  if (from.equip.horseMinus) d -= 1;
  if (from.general && GENERALS_BY_ID[from.general].skills.includes('mashu')) d -= 1;
  return Math.max(1, d);
}

function seatPositions(n: number): { left: string; top: string }[] {
  if (n === 1) return [{ left: '50%', top: '16%' }];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const ang = ((-12 + 204 * t) * Math.PI) / 180;
    const x = 50 + 41 * Math.cos(ang);
    const y = 60 - 47 * Math.sin(ang);
    // Keep the whole seat panel on screen even when the battlefield is short.
    return { left: `${x}%`, top: `max(${Math.max(14, y)}%, 84px)` };
  });
}

export function Table({ net: ns }: { net: NetState }) {
  const room = ns.room!;
  const [actAs, setActAs] = useState<string | null>(null);
  const view = actAs && ns.views?.[actAs] ? ns.views[actAs] : ns.game!;
  const ctl = useController(view, actAs);
  const fx = useFx(view);
  const me = view.players.find((p) => p.id === view.viewer)!;
  const mobile = useIsMobile();
  const others = useMemo(() => {
    const idx = view.players.findIndex((p) => p.id === view.viewer);
    const n = view.players.length;
    return Array.from({ length: n - 1 }, (_, i) => view.players[(idx + 1 + i) % n]);
  }, [view.players, view.viewer]);
  const positions = seatPositions(others.length);
  const waiting = new Set(view.decision?.waitingOn ?? []);
  const connected = new Map(room.members.map((m) => [m.id, m.connected]));
  const targeting = !!ctl.targetSpec && ctl.mine;

  const seatProps = (p: PublicPlayer) => ({
    current: view.turn?.player === p.id,
    waiting: waiting.has(p.id),
    targetable: targeting && ctl.validTargetsNow.has(p.id) && !ctl.selectedTargets.includes(p.id),
    selected: ctl.selectedTargets.includes(p.id),
    invalidReason: ctl.targetSpec?.reasons[p.id],
    targeting,
    fx: fx.seats[p.id],
    onClick: () => ctl.clickSeat(p.id),
    connected: connected.get(p.id) ?? true,
  });

  const modal = (() => {
    const d = view.decision;
    if (!d?.mine) return null;
    switch (d.kind) {
      case 'chooseGeneral':
        return <GeneralSelect view={view} send={ctl.send} />;
      case 'pickCard':
        return <PickCardModal view={view} send={ctl.send} />;
      case 'guanxing':
        return <GuanxingModal view={view} send={ctl.send} />;
      case 'yiji':
        return <YijiModal view={view} send={ctl.send} />;
      case 'harvest':
        return <HarvestModal view={view} send={ctl.send} />;
    }
    return null;
  })();

  return (
    <div className="table">
      <div className="felt" data-testid="battlefield">
        {mobile ? (
          <div className="seats-mobile">
            {others.map((p) => (
              <Seat key={p.id} p={p} pos={null} dist={displayDistance(view, me, p)} {...seatProps(p)} />
            ))}
          </div>
        ) : (
          others.map((p, i) => <Seat key={p.id} p={p} pos={positions[i]} dist={displayDistance(view, me, p)} {...seatProps(p)} />)
        )}
        <Center view={view} stage={fx.stage} />
        {fx.banner && (
          <div key={fx.banner.key} className="turn-banner">
            {fx.banner.text}
          </div>
        )}
      </div>
      <Dashboard view={view} me={me} ctl={ctl} fx={fx} seatProps={seatProps(me)} deadline={ns.deadline} offset={ns.clockOffset} />
      {modal}
      {room.debug && ns.seats && (
        <div className="panel" style={{ position: 'absolute', left: 10, top: 10, padding: 8, zIndex: 25 }}>
          <span className="tiny muted">Debug: act as </span>
          <select className="input" style={{ width: 'auto', display: 'inline-block' }} value={actAs ?? ''} onChange={(e) => setActAs(e.target.value || null)}>
            <option value="">(me)</option>
            {view.players.map((p) => (
              <option key={p.id} value={p.id}>
                {genName(p.general, p.name)} ({p.name})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 760);
  useEffect(() => {
    const on = () => setM(window.innerWidth <= 760);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

function Center({ view, stage }: { view: GameView; stage: ViewLogEntry[] }) {
  const name = (id?: string) => {
    const p = view.players.find((x) => x.id === id);
    return p ? genName(p.general, p.name) : '';
  };
  const res = view.resolving;
  return (
    <div className="center">
      <div className="stage" data-testid="stage">
        {view.judgment ? (
          <div className="stage-item" key={`j${view.judgment.card}`}>
            <CardView id={view.judgment.card} />
            <div className="stage-caption">
              Judgment for <b>{view.judgment.reason}</b> ({name(view.judgment.player)})
            </div>
          </div>
        ) : null}
        {view.harvest.length > 0 && (
          <div className="stage-item">
            <div className="row" style={{ gap: 4 }}>
              {view.harvest.map((id) => (
                <CardView key={id} id={id} size="small" />
              ))}
            </div>
            <div className="stage-caption">Bountiful Harvest</div>
          </div>
        )}
        {!view.judgment &&
          view.harvest.length === 0 &&
          stage.map((e) => (
            <div className="stage-item" key={e.id}>
              <div className="row" style={{ gap: 4 }}>
                {(e.cards ?? []).slice(0, 2).map((id) => (
                  <CardView key={id} id={id} as={e.detail?.card && e.cards!.length === 1 && e.detail.card !== getCard(id).name ? (e.detail.card as never) : undefined} />
                ))}
              </div>
              <div className="stage-caption">{e.text}</div>
            </div>
          ))}
        {!view.judgment && stage.length === 0 && res && (
          <div className="stage-item">
            <CardView as={res.card.name} suit={res.card.suit} rank={res.card.rank} />
            <div className="stage-caption">
              <b>{name(res.user)}</b> → {res.targets.map(name).join(', ')}
            </div>
          </div>
        )}
      </div>
      {view.turn && (
        <div className="phase-banner">
          <span>
            <b style={{ color: 'var(--bronze-2)' }}>{name(view.turn.player)}</b> · Round {view.turn.round}
          </span>
          <div className="phase-steps">
            {Object.keys(PHASE_LABEL).map((ph) => (
              <span key={ph} className={`phase-step ${view.turn!.phase === ph ? 'on' : ''}`} title={PHASE_ZH[ph]}>
                {PHASE_LABEL[ph]}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="piles">
        <div className="pile" title="Draw pile">
          <CardView back size="mini" className="back" /> Deck {view.drawCount}
        </div>
        <div className="pile" title="Discard pile">
          {view.discardTop.length ? <CardView id={view.discardTop[view.discardTop.length - 1]} size="mini" /> : <div className="card mini" style={{ opacity: 0.2 }} />}
          Discard {view.discardCount}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ view, me, ctl, fx, seatProps, deadline, offset }: {
  view: GameView; me: PublicPlayer; ctl: Controller; fx: ReturnType<typeof useFx>;
  seatProps: { current: boolean; targetable: boolean; selected: boolean; onClick(): void };
  deadline: number | null; offset: number;
}) {
  const hand = me.hand ?? [];
  const g = me.general ? GENERALS_BY_ID[me.general] : null;
  const playable = (id: number) => ctl.clickable.has(id);
  const [handWidth, setHandWidth] = useState(800);
  const zoneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHandWidth(el.clientWidth - 20));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const overlap = useMemo(() => {
    const cw = Math.min(112, Math.max(64, window.innerWidth * 0.066));
    const total = hand.length * cw;
    return total > handWidth ? Math.min(cw * 0.75, (total - handWidth) / Math.max(1, hand.length - 1) + 6) : 0;
  }, [hand.length, handWidth]);
  const myFx = fx.seats[me.id];
  const skillUsable = (sid: string) =>
    (ctl.kind === 'play' && view.decision?.playOptions?.some((o) => o.kind === 'skill' && o.skill === sid && !o.disabled)) || ctl.respondSkill.includes(sid);

  return (
    <div className="dash" data-testid="dashboard">
      <div
        className={`me-card ${seatProps.current ? 'current' : ''} ${seatProps.targetable ? 'targetable' : ''} ${seatProps.selected ? 'selected' : ''} ${myFx?.shake ? 'shake' : ''} ${myFx?.flash ? `flash-${myFx.flash}` : ''}`}
        onClick={seatProps.onClick}
        key={myFx?.key}
        data-testid="me-card"
      >
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Portrait general={me.general} w={58} h={74} dead={!me.alive} />
          <div className="col" style={{ gap: 3, minWidth: 0 }}>
            <div className="me-name" title={`${genName(me.general, me.name)} ${genZh(me.general)}`}>
              {genName(me.general, me.name)} <span className="zh">{genZh(me.general)}</span>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <Emblem kingdom={me.kingdom} />
              <RoleBadge role={me.role} />
            </div>
            {me.alive ? <Hp hp={me.hp} max={me.maxHp} big /> : <b style={{ color: 'var(--red)' }}>Dead</b>}
          </div>
        </div>
        <div className="me-skills">
          {(g?.skills ?? []).map((sid) => {
            const s = SKILLS_BY_ID[sid];
            return (
              <button
                key={sid}
                className={`skill-btn ${skillUsable(sid) ? 'usable' : ''} ${ctl.activeOption?.skill === sid ? 'active' : ''} ${s.lord ? 'lord' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  ctl.clickSkill(sid);
                }}
                data-testid={`skill-${sid}`}
                {...tipProps(<SkillTip id={sid} />)}
              >
                {s.en} <span className="zh">{s.zh}</span>
              </button>
            );
          })}
        </div>
        {myFx?.float && <div key={`f${myFx.key}`} className={`fx-float ${myFx.float.cls}`}>{myFx.float.text}</div>}
        {myFx?.toast && <div key={`t${myFx.key}`} className="skill-toast">{myFx.toast}</div>}
      </div>

      <div className="hand-zone" ref={zoneRef}>
        <ActionBar view={view} ctl={ctl} deadline={deadline} offset={offset} />
        <div className="hand" style={{ ['--overlap' as string]: `${overlap}px` }} data-testid="hand">
          {hand.map((id) => (
            <CardView
              key={id}
              id={id}
              testId={`hand-${id}`}
              className={[
                ctl.mine && ctl.clickable.size ? (playable(id) ? 'playable' : 'muted') : '',
                ctl.selectedCards.includes(id) ? 'sel' : '',
                fx.newCards.has(id) ? 'drawn' : '',
              ].join(' ')}
              onClick={() => ctl.clickCard(id)}
              style={{ zIndex: ctl.selectedCards.includes(id) ? 10 : undefined }}
            />
          ))}
          {hand.length === 0 && <div className="muted tiny" style={{ alignSelf: 'center' }}>No cards in hand</div>}
        </div>
      </div>

      <div className="right-dash">
        {SLOT_ORDER.map((slot) => <EquipSlotView key={slot} slot={slot} id={me.equip[slot]} ctl={ctl} />)}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="tiny muted">Judgment area</span>
          <JudgeIcons p={me} />
        </div>
        <label className="row tiny muted" style={{ cursor: 'pointer' }} {...tipProps(<div>When on, optional skills that only help you (draw a card, keep a judgment card…) are used automatically instead of asking every time.</div>)}>
          <input type="checkbox" checked={view.autoUse} onChange={(e) => net.send({ t: 'pref', autoUse: e.target.checked })} /> Auto-use helpful skills
        </label>
      </div>
    </div>
  );
}

function EquipSlotView({ slot, id, ctl }: { slot: EquipSlot; id?: number; ctl: Controller }) {
  const names: Record<EquipSlot, string> = { weapon: 'Weapon', armor: 'Armor', horsePlus: '+1 Horse', horseMinus: '−1 Horse' };
  if (!id) {
    return (
      <div className="equip-slot empty">
        <span style={{ width: 18, textAlign: 'center' }}>{SLOT_ICON[slot]}</span> {names[slot]}
      </div>
    );
  }
  const c = getCard(id);
  const sel = ctl.selectedCards.includes(id);
  return (
    <div
      className={`equip-slot ${ctl.clickable.has(id) ? 'selectable' : ''} ${sel ? 'selected' : ''}`}
      onClick={() => ctl.clickCard(id)}
      data-testid={`equip-${slot}`}
      {...tipProps(<CardTip name={c.name} id={id} />)}
    >
      <span style={{ width: 18, textAlign: 'center' }}>{SLOT_ICON[slot]}</span>
      <b>{CARD_DEFS[c.name].en}</b>
      <span className="zh tiny">{CARD_DEFS[c.name].zh}</span>
      <span style={{ marginLeft: 'auto', color: c.suit === 'heart' || c.suit === 'diamond' ? '#ff7d77' : undefined }}>
        {{ spade: '♠', heart: '♥', club: '♣', diamond: '♦' }[c.suit]}
        {['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c.rank]}
      </span>
    </div>
  );
}

function ActionBar({ view, ctl, deadline, offset }: { view: GameView; ctl: Controller; deadline: number | null; offset: number }) {
  const d = view.decision;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!d) {
    return <div className="action-bar"><span className="prompt muted">{view.status === 'finished' ? 'Game over.' : 'Waiting…'}</span></div>;
  }
  const remaining = deadline ? Math.max(0, deadline - (now + offset)) : null;
  const settings = net.getSnapshot().room?.settings;
  const total = d.timeout === 'select' ? 90000 : ((d.timeout === 'play' ? settings?.turnSeconds : settings?.responseSeconds) || 30) * 1000;
  const timer = remaining !== null && d.mine ? <div className={`timer ${remaining < 8000 ? 'low' : ''}`} style={{ width: `${Math.min(100, (remaining / total) * 100)}%` }} /> : null;
  const secs = remaining !== null ? Math.ceil(remaining / 1000) : null;

  if (!d.mine) {
    return (
      <div className="action-bar" data-testid="action-bar">
        <span className="prompt muted">{d.prompt}</span>
        {secs !== null && <span className="chip">{secs}s</span>}
      </div>
    );
  }

  const spearAvailable = d.kind === 'play' ? d.playOptions?.some((o) => o.key === 'spear' && !o.disabled) : !!d.respond?.spear;
  const prompt = (() => {
    if (d.kind === 'play' && ctl.activeOption) {
      const o = ctl.activeOption;
      const t = o.targets;
      const parts: string[] = [];
      if (o.cardSelect) parts.push(`select ${o.cardSelect.min === o.cardSelect.max ? o.cardSelect.min : `${o.cardSelect.min}–${o.cardSelect.max}`} card(s)`);
      if (t.max > 0) parts.push(t.secondFor ? 'choose 2 targets in order' : `choose ${t.min === t.max ? t.min : `${t.min}–${t.max}`} target(s)`);
      return (
        <>
          <b>{o.kind === 'skill' ? SKILLS_BY_ID[o.skill!]?.en : o.label}</b>: {parts.length ? parts.join(', ') : 'confirm to use'}.
          {t.note && <span className="hint">{t.note}</span>}
        </>
      );
    }
    return <>{d.prompt}</>;
  })();

  return (
    <div className="action-bar mine" data-testid="action-bar">
      <span className="prompt">
        {prompt}
        {ctl.hint && <span className="hint">{ctl.hint}</span>}
      </span>
      {ctl.chooser && (
        <div className="option-chips">
          {ctl.chooser.options.map((o) => (
            <button key={o.key} className="btn small" onClick={() => ctl.chooseOption(o)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {d.kind === 'option' &&
        d.options?.map((o) => (
          <button key={o.id} className={`btn ${o.id === 'yes' ? 'primary' : ''}`} onClick={() => ctl.send({ type: 'option', option: o.id })} data-testid={`opt-${o.id}`}>
            {o.label}
          </button>
        ))}
      {ctl.respondSkill.map((s) => (
        <button key={s} className="btn" onClick={() => ctl.clickSkill(s)} data-testid={`respond-skill-${s}`}>
          {s === 'eightDiagrams' ? 'Eight Trigrams (judge)' : s === 'hujia' ? 'Hujia — ask Wei' : s === 'jijiang' ? 'Jijiang — ask Shu' : s}
        </button>
      ))}
      {spearAvailable && (
        <button className={`btn small ${ctl.spearMode || ctl.activeOption?.key === 'spear' ? 'primary' : ''}`} onClick={ctl.toggleSpear}>
          Serpent Spear
        </button>
      )}
      {['play', 'respond', 'negate', 'cards', 'players'].includes(d.kind) && (ctl.kind !== 'play' || ctl.activeOption) && (
        <button className="btn primary" disabled={!ctl.canConfirm} onClick={ctl.confirm} data-testid="confirm">
          {ctl.confirmLabel}
        </button>
      )}
      {ctl.cancelLabel && (
        <button className="btn" onClick={ctl.cancel} data-testid="cancel">
          {ctl.cancelLabel}
        </button>
      )}
      {d.kind === 'play' && (
        <button className="btn danger" onClick={ctl.endPhase} data-testid="end-play">
          End Play Phase
        </button>
      )}
      {secs !== null && <span className="chip">{secs}s</span>}
      {timer}
    </div>
  );
}

export { PHASE_LABEL };
