// A simple bot that only ever submits legal answers (built from the same legal-option functions
// the UI uses). Used to fill empty seats and to fuzz-test whole matches.

import { getCard } from '../cards/deck';
import type { Game } from './game';
import { negateOptions, playOptions, respondOptions } from './legal';
import type { Rng } from './rng';
import type { Answer, PlayOption, TargetSpec } from './types';

function pickTargets(rng: Rng, s: TargetSpec): string[] {
  if (s.max === 0) return [];
  if (s.secondFor) {
    const first = rng.pick(s.valid);
    return [first, rng.pick(s.secondFor[first])];
  }
  const pool = rng.shuffle([...s.valid]);
  const n = s.min + rng.int(Math.min(s.max, pool.length) - s.min + 1);
  return pool.slice(0, Math.max(s.min, n));
}

function isEnemyGuess(G: Game, me: string, other: string): boolean {
  const a = G.player(me);
  const b = G.player(other);
  if (a.role === 'lord' || a.role === 'loyalist') return b.roleRevealed ? b.role === 'rebel' || b.role === 'renegade' : b.role !== 'lord';
  if (a.role === 'rebel') return b.role === 'lord' || (b.roleRevealed && b.role === 'loyalist') || !b.roleRevealed;
  return b.id !== me;
}

export function botAnswer(G: Game, pid: string, rng: Rng): Answer {
  const d = G.pending!;
  switch (d.kind) {
    case 'chooseGeneral':
      return { type: 'general', general: rng.pick(d.options[pid]) };
    case 'play': {
      const opts = playOptions(G, pid).filter((o) => !o.disabled);
      if (!opts.length || rng.next() < 0.18) return { type: 'end' };
      // Prefer equipment, healing and card draw; avoid hitting the Lord as a loyalist.
      const weight = (o: PlayOption) => {
        if (o.kind === 'skill') return o.skill === 'kurou' ? (G.player(pid).hp > 2 ? 1 : 0) : 1;
        if (!o.as) return 1;
        if (['exNihilo', 'peach'].includes(o.as)) return 4;
        if (getCard(o.cardIds?.[0] ?? 1) && o.cardIds && ['weapon', 'armor', 'horsePlus', 'horseMinus'].some((x) => x === getCardSubtype(o.cardIds![0]))) return 3;
        return 2;
      };
      const weighted = opts.flatMap((o) => Array(weight(o)).fill(o) as PlayOption[]);
      if (!weighted.length) return { type: 'end' };
      const o = rng.pick(weighted);
      let targets = pickTargets(rng, o.targets);
      // try to aim attacks at likely enemies
      if (o.as === 'slash' || o.as === 'duel' || o.as === 'dismantle') {
        const enemies = o.targets.valid.filter((t) => isEnemyGuess(G, pid, t));
        if (enemies.length && o.targets.min === 1 && o.targets.max === 1) targets = [rng.pick(enemies)];
      }
      const cardIds = o.cardIds ?? (o.cardSelect ? rng.shuffle([...o.cardSelect.from]).slice(0, o.cardSelect.min) : []);
      if (o.kind === 'skill') return { type: 'skill', skill: o.skill!, cardIds, targets };
      return { type: 'useCard', cardIds, as: o.as!, skill: o.skill, targets };
    }
    case 'respond': {
      const o = respondOptions(G, pid, d);
      const dying = d.target;
      if (dying && dying !== pid && isEnemyGuess(G, pid, dying) && rng.next() < 0.8) return { type: 'pass' };
      if (o.skills.length && rng.next() < 0.7) return { type: 'respondSkill', skill: rng.pick(o.skills) };
      if (o.cards.length && rng.next() < 0.85) {
        const c = rng.pick(o.cards);
        return { type: 'card', cardIds: c.cardIds, as: c.as, skill: c.skill };
      }
      if (o.spear && rng.next() < 0.5) {
        return { type: 'card', cardIds: rng.shuffle([...o.spear.from]).slice(0, 2), as: 'slash', skill: 'serpentSpear' };
      }
      return { type: 'pass' };
    }
    case 'negate': {
      const ids = negateOptions(G, pid);
      if (ids.length && rng.next() < 0.25) return { type: 'card', cardIds: [ids[0]], as: 'negate' };
      return { type: 'pass' };
    }
    case 'cards': {
      if (d.cancelable && rng.next() < 0.4) return { type: 'pass' };
      const n = d.min + rng.int(d.max - d.min + 1);
      const cardIds = rng.shuffle([...d.selectable]).slice(0, n);
      const targets = d.targets ? rng.shuffle([...d.targets.valid]).slice(0, d.targets.min) : undefined;
      if (d.check) {
        const ans: Answer = { type: 'cards', cardIds, targets };
        if (d.check(ans, pid)) return d.cancelable ? { type: 'pass' } : ans;
        return ans;
      }
      return { type: 'cards', cardIds, targets };
    }
    case 'pickCard': {
      const t = G.player(d.target);
      const opts: Answer[] = [];
      if (d.zones.includes('hand') && t.hand.length) opts.push({ type: 'pick', zone: 'hand' });
      if (d.zones.includes('equip')) for (const id of Object.values(t.equip) as number[]) opts.push({ type: 'pick', cardId: id });
      if (d.zones.includes('judge')) for (const j of t.judge) opts.push({ type: 'pick', cardId: j.card });
      return opts.length ? rng.pick(opts) : { type: 'pass' };
    }
    case 'players': {
      if (d.cancelable && rng.next() < 0.3) return { type: 'pass' };
      return { type: 'players', targets: pickTargets(rng, { min: d.min, max: d.max, valid: d.valid, reasons: {} }) };
    }
    case 'option':
      return { type: 'option', option: rng.pick(d.options).id };
    case 'guanxing': {
      const cards = rng.shuffle([...d.cards]);
      const k = rng.int(cards.length + 1);
      return { type: 'guanxing', top: cards.slice(0, k), bottom: cards.slice(k) };
    }
    case 'yiji':
      return { type: 'yiji', assign: Object.fromEntries(d.cards.map((c) => [String(c), rng.pick(d.valid)])) };
    case 'harvest':
      return { type: 'harvest', cardId: rng.pick(d.cards) };
  }
}

import { CARD_DEFS } from '../cards/definitions';
function getCardSubtype(id: number) {
  return CARD_DEFS[getCard(id).name].subtype;
}
