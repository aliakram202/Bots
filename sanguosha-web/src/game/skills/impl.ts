// Behaviour of every Standard general skill and every equipment effect, as data-driven hook tables.
// The engine calls `ownerHooks(G, player, hookName)` at each timing window; each hook is a flow.

import { getCard, SUIT_SYMBOL, suitColor } from '../cards/deck';
import { generalDef } from '../generals/definitions';
import type { Game, LossInfo } from '../engine/game';
import {
  ask,
  askYesNo,
  damage,
  discardCards,
  drawCards,
  giveCards,
  judge,
  loseHp,
  move,
  pickCardFrom,
  recover,
  requestCard,
  useCard,
  type DamageInfo,
  type SlashCtx,
} from '../engine/flows';
import type { Answer, CardSelectSpec, Flow, PlayerState, Suit, TargetSpec, UsedCard } from '../engine/types';
import {
  inAttackRange,
  protectionReason,
  slashLimit,
  slashTargetReason,
  weaponOf,
} from '../rules/distance';
import { skillDef } from './definitions';

type Hook = (G: Game, p: PlayerState, ...args: any[]) => Flow<any>;

export type HookName =
  | 'onStartPhase'
  | 'onDrawPhase'
  | 'beforeDiscardPhase'
  | 'onEndPhase'
  | 'afterDamaged'
  | 'beforeJudgmentEffect'
  | 'afterJudgment'
  | 'onUseInstantTrick'
  | 'onBecomeSlashTarget'
  | 'afterSlashTarget'
  | 'onSlashDodged'
  | 'beforeSlashDamage'
  | 'onLoseCards';

const sk = (id: string) => skillDef(id).en;

function logSkill(G: Game, pid: string, id: string, extra = '') {
  const def = skillDef(id);
  G.log({ type: 'skill', actor: pid, text: `${G.n(pid)} activated ${def.en} (${def.zh})${extra ? ': ' + extra : '.'}`, detail: { skill: id } });
}

// ───────────────────────── General skills ─────────────────────────

export const SKILL_HOOKS: Record<string, Partial<Record<HookName, Hook>>> = {
  // ── Wei ──
  jianxiong: {
    afterDamaged: function* (G, p, dmg: DamageInfo) {
      const ids = dmg.card?.subcards.filter((id) => G.state.processing.includes(id)) ?? [];
      if (!ids.length) return;
      if (!(yield* askYesNo(G, p.id, `Jianxiong: obtain ${ids.map((i) => G.c(i)).join(', ')} that damaged you?`, { auto: true, skill: sk('jianxiong') }))) return;
      logSkill(G, p.id, 'jianxiong', `obtained ${ids.map((i) => G.c(i)).join(', ')}`);
      G.moveCards(ids, { zone: 'hand', player: p.id });
    },
  },
  fankui: {
    afterDamaged: function* (G, p, dmg: DamageInfo) {
      if (!dmg.source) return;
      const src = G.player(dmg.source);
      if (!src.alive || G.allCardsOf(src).length === 0) return;
      if (!(yield* askYesNo(G, p.id, `Fankui: take one card from ${G.n(src.id)}?`, { skill: sk('fankui') }))) return;
      logSkill(G, p.id, 'fankui');
      const id = yield* pickCardFrom(G, p.id, src.id, ['hand', 'equip'], `Fankui: choose a card of ${G.n(src.id)} to take.`);
      if (id == null) return;
      const wasHand = src.hand.includes(id);
      yield* giveCards(G, src.id, p.id, [id], 'lost', !wasHand);
    },
  },
  guicai: {
    beforeJudgmentEffect: function* (G, p, info: { player: string; card: number; reason: string; goodLabel: string }) {
      if (!p.hand.length) return null;
      const a = yield* ask<Answer>(G, {
        kind: 'cards', players: [p.id], mode: 'single', timeout: 'response',
        prompt: `Guicai: ${G.n(info.player)}'s judgment for ${info.reason} is ${G.c(info.card)} (${info.goodLabel}). Play a hand card to replace it?`,
        min: 1, max: 1, selectable: [...p.hand], cancelable: true, confirmLabel: 'Replace',
        context: { skill: 'guicai', judgment: info.card },
      });
      if (a.type !== 'cards') return null;
      const id = a.cardIds[0];
      logSkill(G, p.id, 'guicai', `replaced the judgment card with ${G.c(id)}`);
      G.log({ type: 'respond', actor: p.id, cards: [id], text: `${G.n(p.id)} played ${G.c(id)} as the new judgment card.` });
      yield* move(G, [id], { zone: 'processing' });
      return id;
    },
  },
  ganglie: {
    afterDamaged: function* (G, p, dmg: DamageInfo) {
      if (!dmg.source) return;
      const src = G.player(dmg.source);
      if (!src.alive) return;
      if (!(yield* askYesNo(G, p.id, `Ganglie: perform a judgment against ${G.n(src.id)}?`, { skill: sk('ganglie') }))) return;
      logSkill(G, p.id, 'ganglie');
      const notHeart = yield* judge(G, p.id, 'Ganglie', (c) => c.suit !== 'heart', 'not ♥ → retaliate');
      if (!notHeart || !src.alive || !p.alive) return;
      let choice = 'damage';
      if (src.hand.length >= 2) {
        const a = yield* ask<Answer>(G, {
          kind: 'option', players: [src.id], mode: 'single', timeout: 'response',
          prompt: `Ganglie: ${G.n(p.id)} retaliates. Discard 2 hand cards, or take 1 damage?`,
          options: [{ id: 'damage', label: 'Take 1 damage' }, { id: 'discard', label: 'Discard 2 hand cards' }],
        });
        choice = (a as { option: string }).option;
      }
      if (choice === 'discard') {
        const a = yield* ask<Answer>(G, {
          kind: 'cards', players: [src.id], mode: 'single', timeout: 'response',
          prompt: 'Ganglie: choose 2 hand cards to discard.', min: 2, max: 2, selectable: [...src.hand], cancelable: false, confirmLabel: 'Discard',
        });
        yield* discardCards(G, src.id, (a as { cardIds: number[] }).cardIds);
      } else {
        yield* damage(G, { source: p.id, target: src.id, amount: 1, nature: 'normal' });
      }
    },
  },
  tuxi: {
    onDrawPhase: function* (G, p, draw: { count: number; skip: boolean }) {
      const valid = G.alivePlayers().filter((q) => q.id !== p.id && q.hand.length > 0).map((q) => q.id);
      if (!valid.length) return;
      const a = yield* ask<Answer>(G, {
        kind: 'players', players: [p.id], mode: 'single', timeout: 'response',
        prompt: 'Tuxi: instead of drawing, take one hand card from each of up to 2 other characters? (Cancel to draw normally.)',
        min: 1, max: 2, valid, cancelable: true, context: { skill: 'tuxi' },
      });
      if (a.type !== 'players') return;
      draw.skip = true;
      logSkill(G, p.id, 'tuxi', `targets ${a.targets.map((t) => G.n(t)).join(', ')}`);
      for (const t of a.targets) {
        const tp = G.player(t);
        if (!tp.hand.length) continue;
        const id = G.rng.pick(tp.hand);
        yield* giveCards(G, t, p.id, [id], 'lost');
      }
    },
  },
  luoyi: {
    onDrawPhase: function* (G, p, draw: { count: number; skip: boolean }) {
      if (!(yield* askYesNo(G, p.id, 'Luoyi: draw 1 fewer card for +1 damage on your Slash/Duel this turn?', { skill: sk('luoyi') }))) return;
      draw.count -= 1;
      G.state.turn!.luoyi = true;
      logSkill(G, p.id, 'luoyi', 'Slash and Duel damage +1 this turn');
    },
  },
  tiandu: {
    afterJudgment: function* (G, p, card: number) {
      if (!(yield* askYesNo(G, p.id, `Tiandu: obtain your judgment card ${G.c(card)}?`, { auto: true, skill: sk('tiandu') }))) return;
      logSkill(G, p.id, 'tiandu', `obtained ${G.c(card)}`);
      G.moveCards([card], { zone: 'hand', player: p.id });
    },
  },
  yiji: {
    afterDamaged: function* (G, p, dmg: DamageInfo) {
      for (let i = 0; i < dmg.amount; i++) {
        if (!p.alive) return;
        if (!(yield* askYesNo(G, p.id, 'Yiji: look at the top 2 cards of the deck and give them to any characters?', { auto: true, skill: sk('yiji') }))) return;
        logSkill(G, p.id, 'yiji');
        const ids = G.takeFromDeck(2);
        if (!ids.length) return;
        const a = yield* ask<Answer>(G, {
          kind: 'yiji', players: [p.id], mode: 'single', timeout: 'response',
          prompt: 'Yiji: give each card to any character (including yourself).',
          cards: ids, valid: G.alivePlayers().map((q) => q.id),
        });
        const assign = (a as { assign: Record<string, string> }).assign;
        const byTarget = new Map<string, number[]>();
        for (const id of ids) {
          const to = assign[String(id)] ?? p.id;
          if (!byTarget.has(to)) byTarget.set(to, []);
          byTarget.get(to)!.push(id);
        }
        for (const [to, cards] of byTarget) {
          if (to === p.id) {
            G.moveCards(cards, { zone: 'hand', player: p.id });
            G.log({ type: 'obtain', actor: p.id, text: `${G.n(p.id)} kept ${cards.length} card${cards.length > 1 ? 's' : ''}.`, private: { [p.id]: { text: `You kept ${cards.map((c) => G.c(c)).join(', ')}.`, cards } } });
          } else {
            yield* giveCards(G, p.id, to, cards, 'gave');
          }
        }
      }
    },
  },
  luoshen: {
    onStartPhase: function* (G, p) {
      while (p.alive) {
        if (!(yield* askYesNo(G, p.id, 'Luoshen: perform a judgment? Black cards are yours; stop at the first red.', { auto: true, skill: sk('luoshen') }))) return;
        logSkill(G, p.id, 'luoshen');
        const black = yield* judge(G, p.id, 'Luoshen', (c) => suitColor(c.suit) === 'black', 'black → keep it',
          { keepIf: (c) => suitColor(c.suit) === 'black' });
        if (!black) return;
      }
    },
  },
  // ── Shu ──
  guanxing: {
    onStartPhase: function* (G, p) {
      const x = Math.min(5, G.alivePlayers().length);
      if (!(yield* askYesNo(G, p.id, `Guanxing: look at the top ${x} cards of the deck and rearrange them?`, { auto: true, skill: sk('guanxing') }))) return;
      const ids = G.takeFromDeck(x);
      if (!ids.length) return;
      logSkill(G, p.id, 'guanxing', `looked at the top ${ids.length} cards`);
      const a = yield* ask<Answer>(G, {
        kind: 'guanxing', players: [p.id], mode: 'single', timeout: 'response',
        prompt: 'Guanxing: put cards on top of the deck (first = drawn first) or at the bottom.', cards: ids,
      });
      const { top, bottom } = a as { top: number[]; bottom: number[] };
      for (const id of [...top].reverse()) G.moveCards([id], { zone: 'drawTop' });
      for (const id of bottom) G.moveCards([id], { zone: 'drawBottom' });
      G.log({ type: 'effect', actor: p.id, text: `${G.n(p.id)} put ${top.length} card(s) on top and ${bottom.length} at the bottom.` });
    },
  },
  tieji: {
    afterSlashTarget: function* (G, p, ctx: SlashCtx) {
      if (!(yield* askYesNo(G, p.id, `Tieji: judge against ${G.n(ctx.target)}? If red, they cannot Dodge.`, { auto: true, skill: sk('tieji') }))) return;
      logSkill(G, p.id, 'tieji');
      if (yield* judge(G, p.id, 'Tieji', (c) => suitColor(c.suit) === 'red', 'red → no Dodge')) ctx.noDodge = true;
    },
  },
  jizhi: {
    onUseInstantTrick: function* (G, p) {
      if (!(yield* askYesNo(G, p.id, 'Jizhi: draw 1 card?', { auto: true, skill: sk('jizhi') }))) return;
      logSkill(G, p.id, 'jizhi');
      yield* drawCards(G, p.id, 1);
    },
  },
  // ── Wu ──
  keji: {
    beforeDiscardPhase: function* (G, p) {
      const t = G.state.turn!;
      if (t.slashUsedOrPlayedInPlay || p.hand.length <= Math.max(0, p.hp)) return;
      if (!(yield* askYesNo(G, p.id, 'Keji: you used no Slash this Play phase. Skip your Discard phase?', { auto: true, skill: sk('keji') }))) return;
      logSkill(G, p.id, 'keji', 'skipped the Discard phase');
      t.skipDiscard = true;
    },
  },
  yingzi: {
    onDrawPhase: function* (G, p, draw: { count: number; skip: boolean }) {
      if (!(yield* askYesNo(G, p.id, 'Yingzi: draw 1 extra card?', { auto: true, skill: sk('yingzi') }))) return;
      draw.count += 1;
      logSkill(G, p.id, 'yingzi', 'draws 1 extra card');
    },
  },
  liuli: {
    onBecomeSlashTarget: function* (G, p, info: { user: string; card: UsedCard; current: string[] }) {
      const own = G.allCardsOf(p);
      if (!own.length) return null;
      const user = G.player(info.user);
      const validFor = (exclude: number[]) =>
        G.alivePlayers()
          .filter((q) => q.id !== p.id && q.id !== info.user && !info.current.includes(q.id))
          .filter((q) => inAttackRange(G, p, q, exclude) && !protectionReason(G, q, 'slash'))
          .map((q) => q.id);
      const valid = validFor([]);
      if (!valid.length) return null;
      const a = yield* ask<Answer>(G, {
        kind: 'cards', players: [p.id], mode: 'single', timeout: 'response',
        prompt: `Liuli: ${G.n(user.id)}'s Slash targets you. Discard a card to redirect it to someone in your attack range?`,
        min: 1, max: 1, selectable: own, cancelable: true, targets: { min: 1, max: 1, valid }, confirmLabel: 'Redirect',
        context: { skill: 'liuli' },
        check: (ans: Answer) => {
          if (ans.type !== 'cards' || !ans.targets) return null;
          return validFor(ans.cardIds).includes(ans.targets[0]) ? null : 'That character is out of your attack range once this card is discarded.';
        },
      });
      if (a.type !== 'cards' || !a.targets) return null;
      logSkill(G, p.id, 'liuli', `redirected the Slash to ${G.n(a.targets[0])}`);
      yield* discardCards(G, p.id, a.cardIds);
      return a.targets[0];
    },
  },
  lianying: {
    onLoseCards: function* (G, p, loss: LossInfo) {
      if (!(loss.handBefore > 0 && loss.handLost.length > 0 && p.hand.length === 0)) return;
      if (!(yield* askYesNo(G, p.id, 'Lianying: you lost your last hand card. Draw 1?', { auto: true, skill: sk('lianying') }))) return;
      logSkill(G, p.id, 'lianying');
      yield* drawCards(G, p.id, 1);
    },
  },
  xiaoji: {
    onLoseCards: function* (G, p, loss: LossInfo) {
      for (let i = 0; i < loss.equipLost.length; i++) {
        if (!p.alive) return;
        if (!(yield* askYesNo(G, p.id, 'Xiaoji: you lost an equipment card. Draw 2?', { auto: true, skill: sk('xiaoji') }))) return;
        logSkill(G, p.id, 'xiaoji');
        yield* drawCards(G, p.id, 2);
      }
    },
  },
  // ── Qun ──
  biyue: {
    onEndPhase: function* (G, p) {
      if (!(yield* askYesNo(G, p.id, 'Biyue: draw 1 card?', { auto: true, skill: sk('biyue') }))) return;
      logSkill(G, p.id, 'biyue');
      yield* drawCards(G, p.id, 1);
    },
  },
};

// ───────────────────────── Equipment effects ─────────────────────────

export const EQUIP_HOOKS: Record<string, Partial<Record<HookName, Hook>>> = {
  doubleSwords: {
    afterSlashTarget: function* (G, p, ctx: SlashCtx) {
      const t = G.player(ctx.target);
      if (!p.gender || !t.gender || p.gender === t.gender) return;
      if (!(yield* askYesNo(G, p.id, `Yin-Yang Swords: make ${G.n(t.id)} discard a hand card or let you draw 1?`, { auto: true, skill: 'Yin-Yang Swords' }))) return;
      G.log({ type: 'skill', actor: p.id, text: `${G.n(p.id)} activated Yin-Yang Swords against ${G.n(t.id)}.`, detail: { skill: 'doubleSwords' } });
      let choice = 'draw';
      if (t.hand.length) {
        const a = yield* ask<Answer>(G, {
          kind: 'option', players: [t.id], mode: 'single', timeout: 'response',
          prompt: `Yin-Yang Swords: discard one hand card, or let ${G.n(p.id)} draw 1 card?`,
          options: [{ id: 'draw', label: `Let ${G.n(p.id)} draw 1` }, { id: 'discard', label: 'Discard a hand card' }],
        });
        choice = (a as { option: string }).option;
      }
      if (choice === 'discard') {
        const a = yield* ask<Answer>(G, {
          kind: 'cards', players: [t.id], mode: 'single', timeout: 'response', prompt: 'Choose a hand card to discard.',
          min: 1, max: 1, selectable: [...t.hand], cancelable: false, confirmLabel: 'Discard',
        });
        yield* discardCards(G, t.id, (a as { cardIds: number[] }).cardIds);
      } else {
        yield* drawCards(G, p.id, 1);
      }
    },
  },
  greenDragon: {
    onSlashDodged: function* (G, p, ctx: SlashCtx) {
      const t = G.player(ctx.target);
      if (!t.alive || slashTargetReason(G, p, t)) return null;
      const r = yield* requestCard(G, p.id, 'slash', 'use', `Green Dragon Blade: your Slash was dodged. Use another Slash on ${G.n(t.id)}?`,
        { slashTarget: t.id, keepInProcessing: true, cancelLabel: 'No', allowLord: false });
      if (!r) return null;
      G.log({ type: 'skill', actor: p.id, text: `${G.n(p.id)} pursues with Green Dragon Blade.`, detail: { skill: 'greenDragon' } });
      yield* useCard(G, p.id, r, [t.id], { countSlash: false, alreadyInProcessing: true });
      return 'done';
    },
  },
  axe: {
    onSlashDodged: function* (G, p, ctx: SlashCtx) {
      const pool = G.allCardsOf(p).filter((id) => id !== p.equip.weapon);
      if (pool.length < 2) return null;
      const a = yield* ask<Answer>(G, {
        kind: 'cards', players: [p.id], mode: 'single', timeout: 'response',
        prompt: `Rock Cleaving Axe: discard 2 cards to make your Slash hit ${G.n(ctx.target)} anyway?`,
        min: 2, max: 2, selectable: pool, cancelable: true, confirmLabel: 'Force hit', context: { skill: 'axe' },
      });
      if (a.type !== 'cards') return null;
      G.log({ type: 'skill', actor: p.id, text: `${G.n(p.id)} activated Rock Cleaving Axe — the Slash hits!`, detail: { skill: 'axe' } });
      yield* discardCards(G, p.id, a.cardIds);
      return 'hit';
    },
  },
  iceSword: {
    beforeSlashDamage: function* (G, p, ctx: SlashCtx) {
      const t = G.player(ctx.target);
      if (!G.allCardsOf(t).length) return null;
      if (!(yield* askYesNo(G, p.id, `Frost Blade: prevent the damage to ${G.n(t.id)} and discard 2 of their cards instead?`, { skill: 'Frost Blade' }))) return null;
      G.log({ type: 'skill', actor: p.id, text: `${G.n(p.id)} activated Frost Blade on ${G.n(t.id)}.`, detail: { skill: 'iceSword' } });
      for (let i = 0; i < 2; i++) {
        if (!G.allCardsOf(t).length) break;
        const id = yield* pickCardFrom(G, p.id, t.id, ['hand', 'equip'], `Frost Blade: choose a card of ${G.n(t.id)} to discard (${i + 1}/2).`);
        if (id == null) break;
        G.log({ type: 'discard', actor: p.id, targets: [t.id], cards: [id], text: `${G.n(t.id)}'s ${G.c(id)} was discarded.` });
        yield* move(G, [id], { zone: 'discard' });
      }
      return 'prevent';
    },
  },
  kylinBow: {
    beforeSlashDamage: function* (G, p, ctx: SlashCtx) {
      const t = G.player(ctx.target);
      const horses = [t.equip.horsePlus, t.equip.horseMinus].filter((x): x is number => !!x);
      if (!horses.length) return null;
      let id = horses[0];
      if (horses.length > 1) {
        const a = yield* ask<Answer>(G, {
          kind: 'option', players: [p.id], mode: 'single', timeout: 'response',
          prompt: `Kylin Bow: discard one of ${G.n(t.id)}'s horses?`,
          options: [{ id: 'no', label: 'No' }, ...horses.map((h) => ({ id: String(h), label: G.c(h) }))],
        });
        const o = (a as { option: string }).option;
        if (o === 'no') return null;
        id = Number(o);
      } else if (!(yield* askYesNo(G, p.id, `Kylin Bow: discard ${G.n(t.id)}'s ${G.c(id)}?`, { skill: 'Kylin Bow' }))) return null;
      G.log({ type: 'discard', actor: p.id, targets: [t.id], cards: [id], text: `Kylin Bow: ${G.n(t.id)}'s ${G.c(id)} was shot down.` });
      yield* move(G, [id], { zone: 'discard' });
      return null;
    },
  },
};

/** Hooks of a given timing that belong to this player (skills first, then equipment). */
export function ownerHooks(G: Game, p: PlayerState, name: HookName): Hook[] {
  if (!p.alive || !p.general) return [];
  const out: Hook[] = [];
  const def = getGeneralSkills(p);
  for (const sid of def) {
    if (!G.hasSkill(p, sid)) continue;
    const h = SKILL_HOOKS[sid]?.[name];
    if (h) out.push(h);
  }
  const w = weaponOf(p);
  if (w) {
    const h = EQUIP_HOOKS[w]?.[name];
    if (h) out.push(h);
  }
  return out;
}

function getGeneralSkills(p: PlayerState): string[] {
  return p.general ? generalDef(p.general).skills : [];
}

// ───────────────────────── Active (Play phase) skills ─────────────────────────

export interface ActiveSkill {
  id: string;
  label: string;
  /** null = usable now; otherwise the reason it is not. */
  canUse(G: Game, p: PlayerState): string | null;
  cards?(G: Game, p: PlayerState): CardSelectSpec;
  targets(G: Game, p: PlayerState): TargetSpec;
  run(G: Game, p: PlayerState, cardIds: number[], targets: string[]): Flow<void>;
}

const noTargets: TargetSpec = { min: 0, max: 0, valid: [], reasons: {} };
const usedThisPhase = (G: Game, id: string) => (G.state.turn?.skillUses[id] ?? 0) > 0;

function othersSpec(G: Game, p: PlayerState, filter: (q: PlayerState) => string | null, min = 1, max = 1): TargetSpec {
  const valid: string[] = [];
  const reasons: Record<string, string> = {};
  for (const q of G.state.players) {
    if (q.id === p.id) continue;
    if (!q.alive) { reasons[q.id] = 'Dead.'; continue; }
    const r = filter(q);
    if (r) reasons[q.id] = r;
    else valid.push(q.id);
  }
  return { min, max, valid, reasons };
}

export const ACTIVE_SKILLS: Record<string, ActiveSkill> = {
  rende: {
    id: 'rende', label: 'Rende — give hand cards',
    canUse: (G, p) => (p.hand.length ? null : 'You have no hand cards to give.'),
    cards: (_G, p) => ({ min: 1, max: p.hand.length, from: [...p.hand] }),
    targets: (G, p) => othersSpec(G, p, () => null),
    run: function* (G, p, cardIds, targets) {
      const t = G.state.turn!;
      logSkill(G, p.id, 'rende', `gave ${cardIds.length} card(s) to ${G.n(targets[0])}`);
      yield* giveCards(G, p.id, targets[0], cardIds, 'gave');
      t.rendeGiven += cardIds.length;
      if (t.rendeGiven >= 2 && !t.rendeHealed) {
        t.rendeHealed = true;
        recover(G, p.id, 1, p.id);
      }
    },
  },
  zhiheng: {
    id: 'zhiheng', label: 'Zhiheng — discard & redraw',
    canUse: (G, p) => (usedThisPhase(G, 'zhiheng') ? 'Zhiheng can be used once per Play phase.' : G.allCardsOf(p).length ? null : 'You have no cards.'),
    cards: (G, p) => ({ min: 1, max: G.allCardsOf(p).length, from: G.allCardsOf(p) }),
    targets: () => noTargets,
    run: function* (G, p, cardIds) {
      logSkill(G, p.id, 'zhiheng');
      yield* discardCards(G, p.id, cardIds);
      yield* drawCards(G, p.id, cardIds.length);
    },
  },
  kurou: {
    id: 'kurou', label: 'Kurou — lose 1 HP, draw 2',
    canUse: () => null,
    targets: () => noTargets,
    run: function* (G, p) {
      logSkill(G, p.id, 'kurou');
      yield* loseHp(G, p.id, 1);
      if (p.alive) yield* drawCards(G, p.id, 2);
    },
  },
  fanjian: {
    id: 'fanjian', label: 'Fanjian — sow discord',
    canUse: (G, p) => (usedThisPhase(G, 'fanjian') ? 'Fanjian can be used once per Play phase.' : p.hand.length ? null : 'You need at least one hand card.'),
    targets: (G, p) => othersSpec(G, p, () => null),
    run: function* (G, p, _c, targets) {
      const t = G.player(targets[0]);
      logSkill(G, p.id, 'fanjian', `targets ${G.n(t.id)}`);
      const suits: Suit[] = ['spade', 'heart', 'club', 'diamond'];
      const a = yield* ask<Answer>(G, {
        kind: 'option', players: [t.id], mode: 'single', timeout: 'response',
        prompt: `Fanjian: ${G.n(p.id)} challenges you. Name a suit — then you take a random card from their hand. If its suit differs, you take 1 damage.`,
        options: suits.map((s) => ({ id: s, label: `${SUIT_SYMBOL[s]} ${s[0].toUpperCase()}${s.slice(1)}` })),
      });
      const named = (a as { option: string }).option as Suit;
      G.log({ type: 'effect', actor: t.id, text: `${G.n(t.id)} named ${SUIT_SYMBOL[named]}.` });
      if (!p.hand.length) return;
      const id = G.rng.pick(p.hand);
      yield* giveCards(G, p.id, t.id, [id], 'revealed and lost', true);
      if (getCard(id).suit !== named && t.alive) {
        yield* damage(G, { source: p.id, target: t.id, amount: 1, nature: 'normal' });
      }
    },
  },
  jieyin: {
    id: 'jieyin', label: 'Jieyin — marriage',
    canUse: (G, p) => (usedThisPhase(G, 'jieyin') ? 'Jieyin can be used once per Play phase.' : p.hand.length >= 2 ? null : 'You need 2 hand cards.'),
    cards: (_G, p) => ({ min: 2, max: 2, from: [...p.hand] }),
    targets: (G, p) => othersSpec(G, p, (q) => (q.gender !== 'male' ? 'Select an injured male character.' : q.hp >= q.maxHp ? 'That character is not injured.' : null)),
    run: function* (G, p, cardIds, targets) {
      logSkill(G, p.id, 'jieyin', `with ${G.n(targets[0])}`);
      yield* discardCards(G, p.id, cardIds);
      recover(G, p.id, 1, p.id);
      recover(G, targets[0], 1, p.id);
    },
  },
  qingnang: {
    id: 'qingnang', label: 'Qingnang — heal',
    canUse: (G, p) => (usedThisPhase(G, 'qingnang') ? 'Qingnang can be used once per Play phase.' : p.hand.length ? null : 'You need a hand card.'),
    cards: (_G, p) => ({ min: 1, max: 1, from: [...p.hand] }),
    targets: (G) => {
      const valid: string[] = [];
      const reasons: Record<string, string> = {};
      for (const q of G.state.players) {
        if (!q.alive) reasons[q.id] = 'Dead.';
        else if (q.hp >= q.maxHp) reasons[q.id] = 'That character is not injured.';
        else valid.push(q.id);
      }
      return { min: 1, max: 1, valid, reasons };
    },
    run: function* (G, p, cardIds, targets) {
      logSkill(G, p.id, 'qingnang', `heals ${G.n(targets[0])}`);
      yield* discardCards(G, p.id, cardIds);
      recover(G, targets[0], 1, p.id);
    },
  },
  lijian: {
    id: 'lijian', label: 'Lijian — make two men duel',
    canUse: (G, p) => (usedThisPhase(G, 'lijian') ? 'Lijian can be used once per Play phase.' : G.allCardsOf(p).length ? null : 'You need a card to discard.'),
    cards: (G, p) => ({ min: 1, max: 1, from: G.allCardsOf(p) }),
    targets: (G, p) => {
      const males = G.alivePlayers().filter((q) => q.gender === 'male' && q.id !== p.id);
      const reasons: Record<string, string> = {};
      for (const q of G.state.players) if (!males.includes(q)) reasons[q.id] = q.alive ? 'Select exactly two male characters.' : 'Dead.';
      const secondFor: Record<string, string[]> = {};
      const valid: string[] = [];
      for (const a of males) {
        const seconds = males.filter((b) => b.id !== a.id && !protectionReason(G, b, 'duel')).map((b) => b.id);
        if (seconds.length) {
          valid.push(a.id);
          secondFor[a.id] = seconds;
        }
      }
      return { min: 2, max: 2, valid, reasons, secondFor, note: 'First: the Duel user. Second: the Duel target.' };
    },
    run: function* (G, p, cardIds, targets) {
      const [a, b] = targets;
      logSkill(G, p.id, 'lijian', `${G.n(a)} duels ${G.n(b)}`);
      yield* discardCards(G, p.id, cardIds);
      const duel: UsedCard = { name: 'duel', subcards: [], suit: null, color: 'none', rank: null, skill: 'lijian' };
      yield* useCard(G, a, duel, [b], { countSlash: false, unnegatable: true });
    },
  },
  jijiang: {
    id: 'jijiang', label: 'Jijiang — ask Shu for a Slash',
    canUse: (G, p) => {
      const t = G.state.turn!;
      if ((t.skillUses['jijiangFailed'] ?? 0) > 0) return 'No Shu character answered Jijiang this phase.';
      if (t.slashUsed >= slashLimit(G, p)) return 'Slash has already been used this Play phase.';
      if (!G.alivePlayers().some((q) => q.id !== p.id && q.kingdom === 'shu')) return 'No other Shu characters alive.';
      return null;
    },
    targets: (G, p) => othersSpec(G, p, (q) => slashTargetReason(G, p, q)),
    run: function* (G, p, _c, targets) {
      logSkill(G, p.id, 'jijiang', `asks Shu characters for a Slash against ${G.n(targets[0])}`);
      for (const q of G.seatOrderFrom(p.id, false)) {
        if (q.kingdom !== 'shu' || !q.alive) continue;
        const r = yield* requestCard(G, q.id, 'slash', 'play',
          `Jijiang: the Lord ${G.n(p.id)} asks you to play a Slash (against ${G.n(targets[0])}) on their behalf.`,
          { allowLord: false, helping: p.id, keepInProcessing: true });
        if (r) {
          yield* useCard(G, p.id, r, targets, { countSlash: true, alreadyInProcessing: true });
          return;
        }
      }
      G.state.turn!.skillUses['jijiangFailed'] = 1;
      G.log({ type: 'effect', actor: p.id, text: 'Nobody answered Jijiang.' });
    },
  },
};
