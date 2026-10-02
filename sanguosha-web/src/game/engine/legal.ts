// Server-side legality: what a player may do right now, and validation of submitted answers.
// The client only renders these options; it never decides legality.

import { getCard, suitColor } from '../cards/deck';
import { CARD_DEFS, equipSlotOf } from '../cards/definitions';
import {
  distance,
  protectionReason,
  slashLimit,
  slashTargetReason,
  weaponOf,
  armorOf,
} from '../rules/distance';
import { ACTIVE_SKILLS } from '../skills/impl';
import { generalDef } from '../generals/definitions';
import type { Game, PendingDecision } from './game';
import type {
  Answer,
  CardName,
  PlayOption,
  PlayerState,
  RespondDecision,
  RespondOptions,
  TargetSpec,
} from './types';

const NONE: TargetSpec = { min: 0, max: 0, valid: [], reasons: {} };

function spec(G: Game, p: PlayerState, check: (q: PlayerState) => string | null, includeSelf = false, max = 1, min = 1): TargetSpec {
  const valid: string[] = [];
  const reasons: Record<string, string> = {};
  for (const q of G.state.players) {
    if (q.id === p.id && !includeSelf) {
      reasons[q.id] = 'You cannot target yourself.';
      continue;
    }
    if (!q.alive) {
      reasons[q.id] = 'Dead.';
      continue;
    }
    const r = check(q);
    if (r) reasons[q.id] = r;
    else valid.push(q.id);
  }
  return { min, max, valid, reasons };
}

const hasAnyCard = (G: Game, q: PlayerState) => G.allCardsOf(q, ['hand', 'equip', 'judge']).length > 0;

/** Targeting rules for using `as` during the Play phase with the given subcards. */
export function targetSpecFor(G: Game, p: PlayerState, as: CardName, cardIds: number[]): { spec: TargetSpec; disabled?: string } {
  const def = CARD_DEFS[as];
  const t = G.state.turn;
  switch (as) {
    case 'slash': {
      if (t && t.slashUsed >= slashLimit(G, p, cardIds)) {
        return { spec: NONE, disabled: 'Slash has already been used this Play phase.' };
      }
      const s = spec(G, p, (q) => slashTargetReason(G, p, q, cardIds));
      const lastHand = cardIds.length > 0 && cardIds.every((id) => p.hand.includes(id)) && p.hand.length === cardIds.length;
      if (weaponOf(p, cardIds) === 'halberd' && lastHand) {
        s.max = 3;
        s.note = 'Sky Piercing Halberd: this is your last hand card — choose up to 3 targets.';
      }
      if (!s.valid.length) return { spec: s, disabled: 'No character is within your attack range.' };
      return { spec: s };
    }
    case 'peach':
      return p.hp < p.maxHp ? { spec: NONE } : { spec: NONE, disabled: 'You are at full HP.' };
    case 'dodge':
      return { spec: NONE, disabled: 'Dodge can only be used in response to an attack.' };
    case 'negate':
      return { spec: NONE, disabled: 'Negate can only be used in response to a trick.' };
    case 'duel': {
      const s = spec(G, p, (q) => protectionReason(G, q, 'duel'));
      return s.valid.length ? { spec: s } : { spec: s, disabled: 'No valid Duel target.' };
    }
    case 'dismantle': {
      const s = spec(G, p, (q) => (hasAnyCard(G, q) ? null : 'Target has no cards.'));
      return s.valid.length ? { spec: s } : { spec: s, disabled: 'No other character has any cards.' };
    }
    case 'steal': {
      const s = spec(G, p, (q) => {
        const prot = protectionReason(G, q, 'steal');
        if (prot) return prot;
        if (!hasAnyCard(G, q)) return 'Target has no cards.';
        if (!G.hasSkill(p, 'qicai')) {
          const d = distance(G, p, q, cardIds);
          if (d > 1) return `Steal requires distance 1 (distance is ${d}).`;
        }
        return null;
      });
      return s.valid.length ? { spec: s } : { spec: s, disabled: 'No character at distance 1 has cards to steal.' };
    }
    case 'exNihilo':
    case 'barbarians':
    case 'arrows':
    case 'peachGarden':
    case 'harvest':
      return { spec: NONE };
    case 'borrowedSword': {
      const secondFor: Record<string, string[]> = {};
      const s = spec(G, p, (q) => {
        if (!q.equip.weapon) return 'Target has no weapon equipped.';
        const seconds = G.alivePlayers().filter((b) => b.id !== q.id && !slashTargetReason(G, q, b)).map((b) => b.id);
        if (!seconds.length) return 'Nobody is within that character\'s attack range.';
        secondFor[q.id] = seconds;
        return null;
      });
      s.min = 2;
      s.max = 2;
      s.secondFor = secondFor;
      s.note = 'First: the armed character. Second: whom they must Slash.';
      return s.valid.length ? { spec: s } : { spec: s, disabled: 'No other character has a weapon with someone in range.' };
    }
    case 'indulgence': {
      const s = spec(G, p, (q) => protectionReason(G, q, 'indulgence') ?? (q.judge.some((j) => j.as === 'indulgence') ? 'Target already has Indulgence.' : null));
      return s.valid.length ? { spec: s } : { spec: s, disabled: 'No valid target for Indulgence.' };
    }
    case 'lightning':
      return p.judge.some((j) => j.as === 'lightning')
        ? { spec: NONE, disabled: 'You already have Lightning in your judgment area.' }
        : { spec: NONE };
    default:
      if (def.category === 'equipment') return { spec: NONE };
      return { spec: NONE, disabled: 'Cannot be used now.' };
  }
}

/** All Play-phase options (enabled and disabled) for the current player. */
export function playOptions(G: Game, pid: string): PlayOption[] {
  const p = G.player(pid);
  const out: PlayOption[] = [];
  const add = (cardIds: number[], as: CardName, skill?: string) => {
    const { spec: s, disabled } = targetSpecFor(G, p, as, cardIds);
    const label = skill ? `${CARD_DEFS[as].en} (${skill})` : CARD_DEFS[as].en;
    out.push({ key: `${cardIds.join('+')}:${as}:${skill ?? ''}`, kind: 'card', label, as, skill, cardIds, targets: s, disabled });
  };
  for (const id of p.hand) {
    const c = getCard(id);
    add([id], c.name);
    if (G.hasSkill(p, 'wusheng') && suitColor(c.suit) === 'red' && c.name !== 'slash') add([id], 'slash', 'wusheng');
    if (G.hasSkill(p, 'longdan') && c.name === 'dodge') add([id], 'slash', 'longdan');
    if (G.hasSkill(p, 'qixi') && suitColor(c.suit) === 'black' && c.name !== 'dismantle') add([id], 'dismantle', 'qixi');
    if (G.hasSkill(p, 'guose') && c.suit === 'diamond' && c.name !== 'indulgence') add([id], 'indulgence', 'guose');
  }
  for (const id of Object.values(p.equip) as number[]) {
    const c = getCard(id);
    if (G.hasSkill(p, 'wusheng') && suitColor(c.suit) === 'red') add([id], 'slash', 'wusheng');
    if (G.hasSkill(p, 'qixi') && suitColor(c.suit) === 'black') add([id], 'dismantle', 'qixi');
    if (G.hasSkill(p, 'guose') && c.suit === 'diamond') add([id], 'indulgence', 'guose');
  }
  if (weaponOf(p) === 'serpentSpear' && p.hand.length >= 2) {
    const { spec: s, disabled } = targetSpecFor(G, p, 'slash', []);
    out.push({
      key: 'spear', kind: 'card', label: 'Slash (Serpent Spear: 2 hand cards)', as: 'slash', skill: 'serpentSpear',
      cardSelect: { min: 2, max: 2, from: [...p.hand] }, targets: s, disabled,
    });
  }
  if (p.general) {
    for (const sid of generalDef(p.general).skills) {
      const impl = ACTIVE_SKILLS[sid];
      if (!impl || !G.hasSkill(p, sid)) continue;
      const disabled = impl.canUse(G, p) ?? undefined;
      const targets = impl.targets(G, p);
      out.push({
        key: `skill:${sid}`, kind: 'skill', label: impl.label, skill: sid,
        cardSelect: impl.cards?.(G, p), targets,
        disabled: disabled ?? (targets.min > 0 && targets.valid.length === 0 ? 'No valid target.' : undefined),
      });
    }
  }
  return out;
}

/** Response options for a respond decision. */
export function respondOptions(G: Game, pid: string, d: RespondDecision): RespondOptions {
  const p = G.player(pid);
  const cards: RespondOptions['cards'] = [];
  const skills: string[] = [];
  let spear: RespondOptions['spear'] = null;
  const target = d.slashTarget ? G.player(d.slashTarget) : null;
  const okSlash = (ids: number[]) => !target || !slashTargetReason(G, p, target, ids);
  const myTurn = G.state.turn?.player === pid;

  if (d.card === 'dodge') {
    for (const id of p.hand) {
      const c = getCard(id);
      if (c.name === 'dodge') cards.push({ cardIds: [id], as: 'dodge' });
      else if (G.hasSkill(p, 'qingguo') && suitColor(c.suit) === 'black') cards.push({ cardIds: [id], as: 'dodge', skill: 'qingguo' });
      else if (G.hasSkill(p, 'longdan') && c.name === 'slash') cards.push({ cardIds: [id], as: 'dodge', skill: 'longdan' });
    }
    if (d.allowArmor !== false && armorOf(p) === 'eightDiagrams') skills.push('eightDiagrams');
    if (d.allowLordSkills !== false && G.hasSkill(p, 'hujia') && G.alivePlayers().some((q) => q.id !== pid && q.kingdom === 'wei')) skills.push('hujia');
  } else if (d.card === 'slash') {
    for (const id of p.hand) {
      const c = getCard(id);
      if (c.name === 'slash' && okSlash([id])) cards.push({ cardIds: [id], as: 'slash' });
      else if (G.hasSkill(p, 'wusheng') && suitColor(c.suit) === 'red' && okSlash([id])) cards.push({ cardIds: [id], as: 'slash', skill: 'wusheng' });
      else if (G.hasSkill(p, 'longdan') && c.name === 'dodge' && okSlash([id])) cards.push({ cardIds: [id], as: 'slash', skill: 'longdan' });
    }
    if (G.hasSkill(p, 'wusheng')) {
      for (const id of Object.values(p.equip) as number[]) {
        if (suitColor(getCard(id).suit) === 'red' && okSlash([id])) cards.push({ cardIds: [id], as: 'slash', skill: 'wusheng' });
      }
    }
    if (weaponOf(p) === 'serpentSpear' && p.hand.length >= 2 && okSlash([])) spear = { min: 2, max: 2, from: [...p.hand] };
    if (d.allowLordSkills !== false && G.hasSkill(p, 'jijiang') && G.alivePlayers().some((q) => q.id !== pid && q.kingdom === 'shu')) {
      if (!target || !slashTargetReason(G, p, target)) skills.push('jijiang');
    }
  } else if (d.card === 'peach') {
    for (const id of p.hand) if (getCard(id).name === 'peach') cards.push({ cardIds: [id], as: 'peach' });
    if (G.hasSkill(p, 'jijiu') && !myTurn) {
      for (const id of G.allCardsOf(p)) {
        const c = getCard(id);
        if (suitColor(c.suit) === 'red' && c.name !== 'peach') cards.push({ cardIds: [id], as: 'peach', skill: 'jijiu' });
        else if (suitColor(c.suit) === 'red' && !p.hand.includes(id)) cards.push({ cardIds: [id], as: 'peach', skill: 'jijiu' });
      }
    }
  }
  return { cards, spear, skills };
}

export function negateOptions(G: Game, pid: string): number[] {
  return G.player(pid).hand.filter((id) => getCard(id).name === 'negate');
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const unique = <T,>(a: T[]) => new Set(a).size === a.length;

function checkTargets(s: TargetSpec, targets: string[]): string | null {
  if (!unique(targets)) return 'Duplicate targets.';
  if (targets.length < s.min || targets.length > s.max) {
    return s.min === s.max ? `Select exactly ${s.min} target${s.min === 1 ? '' : 's'}.` : `Select ${s.min}–${s.max} targets.`;
  }
  if (s.secondFor && targets.length === 2) {
    if (!s.valid.includes(targets[0])) return s.reasons[targets[0]] ?? 'Invalid first target.';
    if (!s.secondFor[targets[0]]?.includes(targets[1])) return 'Invalid second target.';
    return null;
  }
  for (const t of targets) if (!s.valid.includes(t)) return s.reasons[t] ?? 'Invalid target.';
  return null;
}

function checkCardSelect(sel: { min: number; max: number; from: number[] }, ids: number[]): string | null {
  if (!unique(ids)) return 'Duplicate cards.';
  if (ids.length < sel.min || ids.length > sel.max) return sel.min === sel.max ? `Select exactly ${sel.min} card(s).` : `Select ${sel.min}–${sel.max} cards.`;
  for (const id of ids) if (!sel.from.includes(id)) return 'You cannot select that card.';
  return null;
}

export function validateAnswer(G: Game, d: PendingDecision, pid: string, a: Answer): string | null {
  switch (d.kind) {
    case 'chooseGeneral':
      if (a.type !== 'general') return 'Choose a general.';
      return d.options[pid]?.includes(a.general) ? null : 'That general was not offered to you.';
    case 'play': {
      if (a.type === 'end') return null;
      const opts = playOptions(G, pid);
      if (a.type === 'useCard') {
        const o = opts.find((x) => x.kind === 'card' && x.as === a.as && (x.skill ?? undefined) === (a.skill ?? undefined)
          && (x.cardIds ? sameSet(x.cardIds, a.cardIds) : !!x.cardSelect));
        if (!o) return 'You cannot use that card that way.';
        if (o.disabled) return a.targets.map((t) => o.targets.reasons[t]).find(Boolean) ?? o.disabled;
        if (o.cardSelect) {
          const e = checkCardSelect(o.cardSelect, a.cardIds);
          if (e) return e;
        }
        return checkTargets(o.targets, a.targets);
      }
      if (a.type === 'skill') {
        const o = opts.find((x) => x.kind === 'skill' && x.skill === a.skill);
        if (!o) return 'You do not have that skill.';
        if (o.disabled) return o.disabled;
        if (o.cardSelect) {
          const e = checkCardSelect(o.cardSelect, a.cardIds);
          if (e) return e;
        } else if (a.cardIds.length) return 'This skill does not use cards.';
        return checkTargets(o.targets, a.targets);
      }
      return 'Invalid action.';
    }
    case 'respond': {
      if (a.type === 'pass') return null;
      const o = respondOptions(G, pid, d);
      if (a.type === 'respondSkill') return o.skills.includes(a.skill) ? null : 'That ability is not available.';
      if (a.type === 'card') {
        if (a.skill === 'serpentSpear') return o.spear ? checkCardSelect(o.spear, a.cardIds) : 'Serpent Spear is not available.';
        const ok = o.cards.some((x) => x.as === a.as && (x.skill ?? undefined) === (a.skill ?? undefined) && sameSet(x.cardIds, a.cardIds));
        return ok ? null : 'You cannot respond with that card.';
      }
      return 'Invalid response.';
    }
    case 'negate':
      if (a.type === 'pass') return null;
      if (a.type !== 'card' || a.as !== 'negate' || a.cardIds.length !== 1) return 'Invalid Negate.';
      return negateOptions(G, pid).includes(a.cardIds[0]) ? null : 'You do not have that Negate.';
    case 'cards': {
      if (a.type === 'pass') return d.cancelable ? null : 'You must choose.';
      if (a.type !== 'cards') return 'Choose cards.';
      const e = checkCardSelect({ min: d.min, max: d.max, from: d.selectable }, a.cardIds);
      if (e) return e;
      if (d.targets) return checkTargets({ ...d.targets, reasons: {} }, a.targets ?? []);
      return null;
    }
    case 'pickCard': {
      if (a.type === 'pass') return d.cancelable ? null : 'You must choose a card.';
      if (a.type !== 'pick') return 'Choose a card.';
      const t = G.player(d.target);
      if ('zone' in a) return d.zones.includes('hand') && t.hand.length ? null : 'No hand cards to choose.';
      const inEquip = d.zones.includes('equip') && (Object.values(t.equip) as number[]).includes(a.cardId);
      const inJudge = d.zones.includes('judge') && t.judge.some((j) => j.card === a.cardId);
      return inEquip || inJudge ? null : 'You cannot choose that card.';
    }
    case 'players':
      if (a.type === 'pass') return d.cancelable ? null : 'You must choose.';
      if (a.type !== 'players') return 'Choose characters.';
      return checkTargets({ min: d.min, max: d.max, valid: d.valid, reasons: {} }, a.targets);
    case 'option':
      if (a.type !== 'option') return 'Choose an option.';
      return d.options.some((o) => o.id === a.option) ? null : 'Invalid option.';
    case 'guanxing': {
      if (a.type !== 'guanxing') return 'Arrange the cards.';
      return sameSet([...a.top, ...a.bottom], d.cards) ? null : 'Every card must be placed exactly once.';
    }
    case 'yiji': {
      if (a.type !== 'yiji') return 'Assign the cards.';
      for (const id of d.cards) {
        const to = a.assign[String(id)];
        if (!to || !d.valid.includes(to)) return 'Every card needs a living recipient.';
      }
      return Object.keys(a.assign).length === d.cards.length ? null : 'Assign exactly the shown cards.';
    }
    case 'harvest':
      if (a.type !== 'harvest') return 'Choose a card.';
      return d.cards.includes(a.cardId) ? null : 'That card is not available.';
  }
  return 'Unknown decision.';
}

/** Answer used when a player's timer runs out (or for auto-pass). */
export function defaultAnswer(G: Game, d: PendingDecision, pid: string): Answer {
  switch (d.kind) {
    case 'chooseGeneral':
      return { type: 'general', general: d.options[pid][0] };
    case 'play':
      return { type: 'end' };
    case 'respond':
    case 'negate':
      return { type: 'pass' };
    case 'cards':
      if (d.cancelable) return { type: 'pass' };
      return { type: 'cards', cardIds: d.selectable.slice(0, d.min), targets: d.targets ? d.targets.valid.slice(0, d.targets.min) : undefined };
    case 'pickCard': {
      if (d.cancelable) return { type: 'pass' };
      const t = G.player(d.target);
      if (d.zones.includes('hand') && t.hand.length) return { type: 'pick', zone: 'hand' };
      const eq = Object.values(t.equip) as number[];
      if (d.zones.includes('equip') && eq.length) return { type: 'pick', cardId: eq[0] };
      return { type: 'pick', cardId: t.judge[0].card };
    }
    case 'players':
      return d.cancelable ? { type: 'pass' } : { type: 'players', targets: d.valid.slice(0, d.min) };
    case 'option':
      return { type: 'option', option: d.options.find((o) => o.id === 'no')?.id ?? d.options[0].id };
    case 'guanxing':
      return { type: 'guanxing', top: [...d.cards], bottom: [] };
    case 'yiji':
      return { type: 'yiji', assign: Object.fromEntries(d.cards.map((c) => [String(c), pid])) };
    case 'harvest':
      return { type: 'harvest', cardId: d.cards[0] };
  }
}

export { equipSlotOf };
