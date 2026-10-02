import { useState } from 'react';
import { GENERALS_BY_ID, KINGDOM_INFO } from '../../game/generals/definitions';
import { SKILLS_BY_ID } from '../../game/skills/definitions';
import type { Answer } from '../../game/engine/types';
import type { GameView } from '../../game/engine/view';
import { CardView } from '../components/CardView';
import { Emblem, genName, SkillTip } from '../components/info';
import { Portrait } from '../components/Portrait';
import { tipProps } from '../components/Tooltip';
import { SLOT_ICON, SLOT_ORDER } from './Seat';

type Send = (a: Answer) => void;

export function GeneralSelect({ view, send }: { view: GameView; send: Send }) {
  const d = view.decision!;
  const [chosen, setChosen] = useState<string | null>(null);
  const lord = view.players.find((p) => p.id === view.lord);
  const me = view.players.find((p) => p.id === view.viewer);
  return (
    <div className="modal-back">
      <div className="modal panel" data-testid="general-select">
        <h2>Choose your general</h2>
        <div className="muted">
          {d.prompt} Your role: <b>{me?.role ? me.role[0].toUpperCase() + me.role.slice(1) : '?'}</b>
          {lord?.general && lord.id !== view.viewer ? ` · Lord: ${genName(lord.general, lord.name)}` : ''}
        </div>
        <div className="gen-grid">
          {(d.generals ?? []).map((id) => {
            const g = GENERALS_BY_ID[id];
            return (
              <button key={id} className={`gen-card ${chosen === id ? 'chosen' : ''}`} onClick={() => setChosen(id)} data-testid={`gen-${id}`}>
                <Portrait general={id} w={112} h={140} />
                <div className="row">
                  <Emblem kingdom={g.kingdom} />
                  <b style={{ fontSize: 16 }}>{g.en}</b>
                  <span className="zh">{g.zh}</span>
                </div>
                <div className="muted tiny">
                  {KINGDOM_INFO[g.kingdom].en} · {g.gender} · {g.hp} HP{g.isLord ? ' · Lord' : ''} · <i>{g.title}</i>
                </div>
                {g.skills.map((s) => (
                  <div key={s} className="skill-desc" {...tipProps(<SkillTip id={s} />)}>
                    <b>{SKILLS_BY_ID[s].en}</b> <span className="zh">{SKILLS_BY_ID[s].zh}</span>
                    {SKILLS_BY_ID[s].lord ? ' (Lord)' : ''}: {SKILLS_BY_ID[s].text}
                  </div>
                ))}
              </button>
            );
          })}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn primary" disabled={!chosen} onClick={() => chosen && send({ type: 'general', general: chosen })} data-testid="confirm-general">
            Confirm {chosen ? GENERALS_BY_ID[chosen].en : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PickCardModal({ view, send }: { view: GameView; send: Send }) {
  const d = view.decision!;
  const pick = d.pick!;
  const t = view.players.find((p) => p.id === pick.target)!;
  return (
    <div className="modal-back">
      <div className="modal panel" style={{ width: 'min(640px, 100%)' }} data-testid="pick-card">
        <h2>Choose a card</h2>
        <div className="muted">{d.prompt}</div>
        {pick.zones.includes('hand') && pick.handCount > 0 && (
          <div className="pick-zone">
            <div className="tiny muted">Hand ({pick.handCount}) — chosen blindly</div>
            <div className="pick-row">
              {Array.from({ length: pick.handCount }, (_, i) => (
                <CardView key={i} back size="small" onClick={() => send({ type: 'pick', zone: 'hand' })} testId={`pick-hand-${i}`} />
              ))}
            </div>
          </div>
        )}
        {pick.equip.length > 0 && (
          <div className="pick-zone">
            <div className="tiny muted">Equipment</div>
            <div className="pick-row">
              {SLOT_ORDER.filter((s) => t.equip[s]).map((s) => (
                <div key={s} className="col" style={{ alignItems: 'center', gap: 2 }}>
                  <CardView id={t.equip[s]} size="small" onClick={() => send({ type: 'pick', cardId: t.equip[s]! })} />
                  <span className="tiny muted">{SLOT_ICON[s]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {pick.judge.length > 0 && (
          <div className="pick-zone">
            <div className="tiny muted">Judgment area</div>
            <div className="pick-row">
              {pick.judge.map((id) => (
                <CardView key={id} id={id} size="small" onClick={() => send({ type: 'pick', cardId: id })} />
              ))}
            </div>
          </div>
        )}
        {pick.cancelable && (
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn" onClick={() => send({ type: 'pass' })}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function GuanxingModal({ view, send }: { view: GameView; send: Send }) {
  const d = view.decision!;
  const [top, setTop] = useState<number[]>(d.revealed ?? []);
  const [bottom, setBottom] = useState<number[]>([]);
  const moveTo = (id: number, where: 'top' | 'bottom') => {
    setTop((t) => (where === 'top' ? [...t.filter((x) => x !== id), id] : t.filter((x) => x !== id)));
    setBottom((b) => (where === 'bottom' ? [...b.filter((x) => x !== id), id] : b.filter((x) => x !== id)));
  };
  const shift = (id: number, dir: -1 | 1) =>
    setTop((t) => {
      const i = t.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= t.length) return t;
      const n = [...t];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <div className="modal-back">
      <div className="modal panel" data-testid="guanxing">
        <h2>Guanxing 观星</h2>
        <div className="muted">{d.prompt} Click a card to move it between the top and bottom of the deck; use ◀ ▶ to reorder the top.</div>
        <div className="pick-zone">
          <div className="tiny muted">Top of deck (leftmost is drawn first)</div>
          <div className="pick-row">
            {top.map((id) => (
              <div key={id} className="col" style={{ alignItems: 'center', gap: 4 }}>
                <CardView id={id} size="small" onClick={() => moveTo(id, 'bottom')} />
                <div className="row" style={{ gap: 2 }}>
                  <button className="btn small icon" onClick={() => shift(id, -1)}>◀</button>
                  <button className="btn small icon" onClick={() => shift(id, 1)}>▶</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="pick-zone">
          <div className="tiny muted">Bottom of deck</div>
          <div className="pick-row" style={{ minHeight: 60 }}>
            {bottom.map((id) => (
              <CardView key={id} id={id} size="small" onClick={() => moveTo(id, 'top')} />
            ))}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn primary" onClick={() => send({ type: 'guanxing', top, bottom })}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

export function YijiModal({ view, send }: { view: GameView; send: Send }) {
  const d = view.decision!;
  const cards = d.revealed ?? [];
  const [assign, setAssign] = useState<Record<string, string>>(Object.fromEntries(cards.map((c) => [String(c), view.viewer!])));
  const recipients = (d.validRecipients ?? []).map((id) => view.players.find((p) => p.id === id)!);
  return (
    <div className="modal-back">
      <div className="modal panel" style={{ width: 'min(620px, 100%)' }} data-testid="yiji">
        <h2>Yiji 遗计</h2>
        <div className="muted">{d.prompt}</div>
        {cards.map((c) => (
          <div key={c} className="row" style={{ marginTop: 12 }}>
            <CardView id={c} size="small" />
            <select className="input" value={assign[String(c)]} onChange={(e) => setAssign({ ...assign, [String(c)]: e.target.value })}>
              {recipients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === view.viewer ? 'Keep (you)' : `${genName(p.general, p.name)} — ${p.name}`}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn primary" onClick={() => send({ type: 'yiji', assign })}>Give cards</button>
        </div>
      </div>
    </div>
  );
}

export function HarvestModal({ view, send }: { view: GameView; send: Send }) {
  const d = view.decision!;
  return (
    <div className="modal-back">
      <div className="modal panel" style={{ width: 'min(720px, 100%)' }} data-testid="harvest">
        <h2>Bountiful Harvest 五谷丰登</h2>
        <div className="muted">{d.prompt}</div>
        <div className="pick-row" style={{ marginTop: 12 }}>
          {(d.revealed ?? []).map((id) => (
            <CardView key={id} id={id} onClick={() => send({ type: 'harvest', cardId: id })} />
          ))}
        </div>
      </div>
    </div>
  );
}
