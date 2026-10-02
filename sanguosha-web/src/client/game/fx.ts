// Turns new log entries into short-lived visual effects + sound cues.
import { useEffect, useRef, useState } from 'react';
import type { GameView, ViewLogEntry } from '../../game/engine/view';
import { SKILLS_BY_ID } from '../../game/skills/definitions';
import { sfx } from '../sound';

export interface SeatFx {
  key: number;
  shake?: boolean;
  flash?: 'red' | 'green';
  float?: { text: string; cls: 'dmg' | 'heal' };
  toast?: string;
}

export interface FxState {
  seats: Record<string, SeatFx>;
  banner: { key: number; text: string } | null;
  stage: ViewLogEntry[];
  newCards: Set<number>;
}

export function useFx(view: GameView | null): FxState {
  const last = useRef<number>(-1);
  const [state, setState] = useState<FxState>({ seats: {}, banner: null, stage: [], newCards: new Set() });

  useEffect(() => {
    if (!view) return;
    const entries = view.log;
    const maxId = entries.length ? entries[entries.length - 1].id : 0;
    if (last.current === -1) {
      // first render: don't replay history
      last.current = maxId;
      setState((s) => ({ ...s, stage: stageFrom(entries) }));
      return;
    }
    const fresh = entries.filter((e) => e.id > last.current);
    last.current = maxId;
    if (!fresh.length) return;
    const seats: Record<string, SeatFx> = {};
    let banner: FxState['banner'] = null;
    const newCards = new Set<number>();
    let k = Date.now();
    const sound = new Set<keyof typeof sfx>();
    for (const e of fresh) {
      k++;
      const t = e.targets?.[0] ?? e.actor;
      switch (e.type) {
        case 'damage': {
          const amt = Number(e.detail?.amount ?? 1);
          if (t) seats[t] = { key: k, shake: true, flash: 'red', float: { text: `−${amt}`, cls: 'dmg' } };
          sound.add('damage');
          break;
        }
        case 'loseHp':
          if (e.actor) seats[e.actor] = { key: k, shake: true, flash: 'red', float: { text: `−${e.detail?.amount ?? 1}`, cls: 'dmg' } };
          sound.add('damage');
          break;
        case 'recover':
          if (t) seats[t] = { key: k, flash: 'green', float: { text: `+${e.detail?.amount ?? 1}`, cls: 'heal' } };
          sound.add('heal');
          break;
        case 'skill': {
          const sid = String(e.detail?.skill ?? '');
          const s = SKILLS_BY_ID[sid];
          const label = s ? `${s.en} ${s.zh}` : sid === 'eightDiagrams' ? 'Eight Trigrams' : sid === 'iceSword' ? 'Frost Blade' : sid === 'axe' ? 'Rock Cleaving Axe' : sid === 'greenDragon' ? 'Green Dragon Blade' : sid === 'doubleSwords' ? 'Yin-Yang Swords' : sid;
          if (e.actor) seats[e.actor] = { ...(seats[e.actor] ?? { key: k }), key: k, toast: label };
          sound.add('skill');
          break;
        }
        case 'turnStart':
          banner = { key: k, text: e.text.replace(/—/g, '').trim() };
          sound.add(e.actor === view.viewer ? 'yourTurn' : 'turn');
          break;
        case 'death':
          sound.add('death');
          break;
        case 'useCard':
        case 'respond':
        case 'equip':
          sound.add('card');
          break;
        case 'judge':
          sound.add('judge');
          break;
        case 'draw':
        case 'give':
        case 'obtain':
          if (e.private && e.cards) e.cards.forEach((c) => newCards.add(c));
          sound.add('draw');
          break;
        case 'gameOver':
          sound.add('win');
          break;
      }
    }
    sound.forEach((s) => sfx[s]());
    setState((prev) => ({
      seats: { ...prev.seats, ...seats },
      banner: banner ?? prev.banner,
      stage: stageFrom(entries),
      newCards,
    }));
  }, [view?.log]);

  return state;
}

/** Recent card plays of the current turn to show on the battlefield. */
function stageFrom(entries: ViewLogEntry[]): ViewLogEntry[] {
  const out: ViewLogEntry[] = [];
  for (let i = entries.length - 1; i >= 0 && out.length < 4; i--) {
    const e = entries[i];
    if (e.type === 'turnStart') break;
    if ((e.type === 'useCard' || e.type === 'respond' || e.type === 'judge' || e.type === 'equip' || e.type === 'reveal') && e.cards?.length) out.unshift(e);
  }
  return out.slice(-3);
}
