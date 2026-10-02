// Generator-based game flows. Each flow yields Decisions and receives validated Answers.
// The whole game is one deterministic generator, so a match can be reproduced from
// (config + seed + command list) — used for persistence, reconnect and replays.

import { getCard, suitColor } from '../cards/deck';
import { CARD_DEFS, equipSlotOf, isInstantTrick } from '../cards/definitions';
import { GENERALS, generalDef } from '../generals/definitions';
import { checkVictory, rolesFor, ROLE_INFO } from '../rules/roles';
import { armorOf, slashTargetReason, weaponOf } from '../rules/distance';
import { Game, GameOverSignal, TurnEndSignal, type Destination, type LossInfo } from './game';
import { ownerHooks, ACTIVE_SKILLS } from '../skills/impl';
import type {
  Answer,
  CardName,
  Decision,
  Flow,
  PhysicalCard,
  PlayerState,
  RespondCard,
  RespondDecision,
  Role,
  UsedCard,
} from './types';

// ───────────────────────── helpers ─────────────────────────

export function* ask<T = Answer>(G: Game, d: Omit<Decision, 'id'> & Record<string, unknown>): Flow<T> {
  const decision = { ...d, id: G.nextDecisionId() } as Decision;
  return (yield decision) as T;
}

/** Ask an optional yes/no for a skill. Benefit-only skills are auto-used when the player enabled auto-use. */
export function* askYesNo(G: Game, pid: string, prompt: string, opts: { auto?: boolean; skill?: string } = {}): Flow<boolean> {
  if (opts.auto && G.autoUse[pid]) return true;
  const a = yield* ask<Answer>(G, {
    kind: 'option',
    players: [pid],
    mode: 'single',
    prompt,
    timeout: 'response',
    context: { skill: opts.skill },
    options: [
      { id: 'yes', label: opts.skill ? `Use ${opts.skill}` : 'Yes' },
      { id: 'no', label: 'No' },
    ],
  });
  return a.type === 'option' && a.option === 'yes';
}

export function* move(G: Game, ids: number[], dest: Destination): Flow<void> {
  if (ids.length === 0) return;
  const losses = G.moveCards(ids, dest);
  yield* afterLoss(G, losses);
}

function* afterLoss(G: Game, losses: LossInfo[]): Flow<void> {
  for (const l of losses) {
    const p = G.player(l.player);
    if (!p.alive) continue;
    for (const h of ownerHooks(G, p, 'onLoseCards')) yield* h(G, p, l);
  }
}

export function* drawCards(G: Game, pid: string, n: number, reason = 'drew'): Flow<number[]> {
  const p = G.player(pid);
  if (n <= 0 || !p.alive) return [];
  const ids = G.takeFromDeck(n);
  if (ids.length < n && G.state.drawPile.length === 0 && G.state.discardPile.length === 0) {
    G.moveCards(ids, { zone: 'hand', player: pid });
    G.state.winner = { side: 'draw', winners: [], reason: 'The deck and discard pile are both exhausted — the game is a draw.' };
    throw new GameOverSignal();
  }
  G.moveCards(ids, { zone: 'hand', player: pid });
  G.log({
    type: 'draw',
    actor: pid,
    text: `${G.n(pid)} ${reason} ${ids.length} card${ids.length === 1 ? '' : 's'}.`,
    private: { [pid]: { text: `You ${reason} ${ids.map((i) => G.c(i)).join(', ')}.`, cards: ids } },
    detail: { count: ids.length },
  });
  return ids;
}

export function* discardCards(G: Game, pid: string, ids: number[], reason = 'discarded'): Flow<void> {
  if (!ids.length) return;
  G.log({ type: 'discard', actor: pid, cards: ids, text: `${G.n(pid)} ${reason} ${ids.map((i) => G.c(i)).join(', ')}.` });
  yield* move(G, ids, { zone: 'discard' });
}

/** Move cards to another player's hand with private visibility for the two parties. */
export function* giveCards(G: Game, from: string | null, to: string, ids: number[], verb: string, publicCards = false): Flow<void> {
  if (!ids.length) return;
  const names = ids.map((i) => G.c(i)).join(', ');
  const priv: Record<string, { text: string; cards?: number[] }> = { [to]: { text: `${from ? G.n(from) : ''} ${verb} → you: ${names}.`, cards: ids } };
  if (from) priv[from] = { text: `${G.n(from)} ${verb} ${names} → ${G.n(to)}.`, cards: ids };
  G.log({
    type: 'give',
    actor: from ?? undefined,
    targets: [to],
    cards: publicCards ? ids : undefined,
    text: publicCards
      ? `${from ? G.n(from) + ' ' : ''}${verb} ${names} → ${G.n(to)}.`
      : `${from ? G.n(from) + ' ' : ''}${verb} ${ids.length} card${ids.length === 1 ? '' : 's'} → ${G.n(to)}.`,
    private: publicCards ? undefined : priv,
  });
  yield* move(G, ids, { zone: 'hand', player: to });
}

export function recover(G: Game, pid: string, amount: number, source?: string): void {
  const p = G.player(pid);
  if (!p.alive) return;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  const gained = p.hp - before;
  if (gained > 0) {
    G.log({
      type: 'recover',
      actor: source,
      targets: [pid],
      text: `${G.n(pid)} recovered ${gained} HP (${p.hp}/${p.maxHp}).`,
      detail: { amount: gained },
    });
  }
}

// ───────────────────────── main / setup ─────────────────────────

export function* mainFlow(G: Game): Flow<void> {
  try {
    yield* setupFlow(G);
    yield* turnLoop(G);
  } catch (e) {
    if (!(e instanceof GameOverSignal)) throw e;
  }
  finishGame(G);
}

function finishGame(G: Game) {
  const s = G.state;
  s.status = 'finished';
  for (const p of s.players) p.roleRevealed = true;
  if (s.winner) {
    G.log({ type: 'gameOver', text: `Game over. ${s.winner.reason}`, detail: { side: s.winner.side, winners: s.winner.winners } });
  }
  // Return all cards in transient zones so invariants hold at the end.
  G.moveCards([...s.processing, ...s.harvest], { zone: 'discard' });
  s.judgment = null;
  s.resolving = null;
}

function resolveCardSpec(G: Game, spec: CardName | number, used: Set<number>): number {
  if (typeof spec === 'number') {
    if (used.has(spec)) throw new Error(`scenario card ${spec} used twice`);
    used.add(spec);
    return spec;
  }
  const id = G.state.drawPile.find((i) => getCard(i).name === spec && !used.has(i));
  if (id === undefined) throw new Error(`No ${spec} left in deck for scenario`);
  used.add(id);
  return id;
}

function* setupFlow(G: Game): Flow<void> {
  const s = G.state;
  const players = s.players;
  const sc = G.config.scenario;

  // 1. Roles
  if (sc?.roles) {
    for (const p of players) p.role = sc.roles[p.id] ?? 'rebel';
  } else {
    const roles = G.rng.shuffle(rolesFor(players.length, G.config.roleVariant)) as Role[];
    players.forEach((p, i) => (p.role = roles[i]));
  }
  const lord = players.find((p) => p.role === 'lord')!;
  lord.roleRevealed = true;
  G.log({ type: 'roles', actor: lord.id, text: `${lord.name} is the Lord (主公). All other roles are secret.` });
  for (const p of players) {
    if (p.role !== 'lord') G.log({ type: 'role', text: '', private: { [p.id]: { text: `Your secret role: ${ROLE_INFO[p.role].en} (${ROLE_INFO[p.role].zh}). ${ROLE_INFO[p.role].goal}` } } });
  }

  // 2. Generals
  if (sc?.generals) {
    for (const p of players) assignGeneral(G, p, sc.generals[p.id] ?? GENERALS[p.seat].id);
  } else {
    const pool = G.rng.shuffle(GENERALS.map((x) => x.id));
    const lordOptions = ['caocao', 'liubei', 'sunquan'];
    const rest = pool.filter((x) => !lordOptions.includes(x));
    const lordChoices = [...lordOptions, rest[0], rest[1]];
    const lordAns = yield* ask<Answer>(G, {
      kind: 'chooseGeneral',
      players: [lord.id],
      mode: 'single',
      prompt: 'You are the Lord. Choose your general — your choice is shown to everyone before the others pick.',
      timeout: 'select',
      options: { [lord.id]: lordChoices },
    });
    const lordPick = (lordAns as { general: string }).general;
    assignGeneral(G, lord, lordPick);
    G.log({ type: 'general', actor: lord.id, text: `The Lord ${lord.name} chose ${G.n(lord.id)} (${generalDef(lordPick).zh}).` });

    const remaining = G.rng.shuffle(pool.filter((x) => x !== lordPick));
    const k = G.config.generalChoices ?? 3;
    const others = players.filter((p) => p.id !== lord.id);
    const per = Math.max(1, Math.min(k, Math.floor(remaining.length / Math.max(1, others.length))));
    const options: Record<string, string[]> = {};
    others.forEach((p, i) => (options[p.id] = remaining.slice(i * per, i * per + per)));
    if (others.length) {
      const picks = yield* ask<Record<string, Answer>>(G, {
        kind: 'chooseGeneral',
        players: others.map((p) => p.id),
        mode: 'all',
        prompt: `Choose your general. Lord: ${G.n(lord.id)}. Your options are private.`,
        timeout: 'select',
        options,
      });
      for (const p of others) assignGeneral(G, p, (picks[p.id] as { general: string }).general);
    }
    G.log({ type: 'generalsRevealed', text: `Generals revealed: ${players.map((p) => `${p.name} → ${G.n(p.id)}`).join(', ')}.` });
  }

  // HP: Lord gets +1 max HP with 5+ players.
  for (const p of players) {
    const def = generalDef(p.general!);
    p.maxHp = def.hp + (p.role === 'lord' && players.length >= 5 ? 1 : 0);
    p.hp = sc?.hp?.[p.id] ?? p.maxHp;
  }

  // 3. Scenario card placement
  if (sc) {
    const used = new Set<number>();
    for (const p of players) {
      for (const spec of sc.equips?.[p.id] ?? []) {
        const id = resolveCardSpec(G, spec, used);
        G.moveCards([id], { zone: 'equip', player: p.id });
      }
      for (const spec of sc.judges?.[p.id] ?? []) {
        const id = resolveCardSpec(G, spec, used);
        const as = typeof spec === 'string' ? spec : (getCard(id).name as 'indulgence' | 'lightning');
        G.moveCards([id], { zone: 'judge', player: p.id, as });
      }
      for (const spec of sc.hands?.[p.id] ?? []) {
        const id = resolveCardSpec(G, spec, used);
        G.moveCards([id], { zone: 'hand', player: p.id });
      }
    }
    const top = (sc.deckTop ?? []).map((spec) => resolveCardSpec(G, spec, used));
    for (const id of [...top].reverse()) G.moveCards([id], { zone: 'drawTop' });
  }

  // 4. Starting hands: 4 cards each.
  s.status = 'playing';
  if (!sc || sc.dealStartingHands) {
    for (const p of G.seatOrderFrom(lord.id)) {
      const ids = G.takeFromDeck(4);
      G.moveCards(ids, { zone: 'hand', player: p.id });
      G.log({ type: 'draw', actor: p.id, text: `${G.n(p.id)} drew 4 starting cards.`, private: { [p.id]: { text: `Starting hand: ${ids.map((i) => G.c(i)).join(', ')}.`, cards: ids } }, detail: { count: 4 } });
    }
  }
}

function assignGeneral(G: Game, p: PlayerState, id: string) {
  const def = generalDef(id);
  p.general = id;
  p.kingdom = def.kingdom;
  p.gender = def.gender;
}

// ───────────────────────── turns ─────────────────────────

function* turnLoop(G: Game): Flow<void> {
  const s = G.state;
  const lord = s.players.find((p) => p.role === 'lord')!;
  let current = G.config.scenario?.startPlayer ? G.player(G.config.scenario.startPlayer) : lord;
  s.round = 1;
  while (true) {
    if (current.alive) yield* runTurn(G, current);
    const next = G.nextAliveAfter(current.id);
    if (next.id === lord.id) s.round++;
    current = next;
  }
}

function newTurn(pid: string) {
  return {
    player: pid,
    phase: 'start' as const,
    slashUsed: 0,
    slashUsedOrPlayedInPlay: false,
    skillUses: {},
    luoyi: false,
    rendeGiven: 0,
    rendeHealed: false,
    skipPlay: false,
    skipDiscard: false,
  };
}

export function* runTurn(G: Game, p: PlayerState): Flow<void> {
  const s = G.state;
  s.turn = newTurn(p.id);
  G.log({ type: 'turnStart', actor: p.id, text: `— ${G.n(p.id)}'s turn (round ${s.round}) —` });
  try {
    // Start phase
    s.turn.phase = 'start';
    for (const h of ownerHooks(G, p, 'onStartPhase')) yield* h(G, p);
    // Judgment phase
    s.turn.phase = 'judgment';
    yield* judgmentPhase(G, p);
    // Draw phase
    s.turn.phase = 'draw';
    G.log({ type: 'phase', actor: p.id, text: `${G.n(p.id)} — Draw phase.` });
    const draw = { count: 2, skip: false };
    for (const h of ownerHooks(G, p, 'onDrawPhase')) yield* h(G, p, draw);
    if (!draw.skip) yield* drawCards(G, p.id, draw.count);
    // Play phase
    s.turn.phase = 'play';
    if (s.turn.skipPlay) {
      G.log({ type: 'phase', actor: p.id, text: `${G.n(p.id)} skips the Play phase.` });
    } else {
      G.log({ type: 'phase', actor: p.id, text: `${G.n(p.id)} — Play phase.` });
      yield* playPhase(G, p);
    }
    // Discard phase
    s.turn.phase = 'discard';
    for (const h of ownerHooks(G, p, 'beforeDiscardPhase')) yield* h(G, p);
    if (!s.turn.skipDiscard) yield* discardPhase(G, p);
    else G.log({ type: 'phase', actor: p.id, text: `${G.n(p.id)} skips the Discard phase.` });
    // End phase
    s.turn.phase = 'end';
    for (const h of ownerHooks(G, p, 'onEndPhase')) yield* h(G, p);
  } catch (e) {
    if (!(e instanceof TurnEndSignal)) throw e;
    G.log({ type: 'turnEnd', text: `${G.n(p.id)}'s turn ends immediately.` });
  } finally {
    // Anything left mid-resolution goes to the discard pile.
    if (s.status !== 'finished') {
      G.moveCards([...s.processing, ...s.harvest], { zone: 'discard' });
      s.judgment = null;
      s.resolving = null;
    }
  }
  s.turn = null;
}

function* judgmentPhase(G: Game, p: PlayerState): Flow<void> {
  const s = G.state;
  if (!p.judge.length) return;
  G.log({ type: 'phase', actor: p.id, text: `${G.n(p.id)} — Judgment phase.` });
  // Delayed tricks resolve from the most recently placed one.
  const queue = [...p.judge].reverse();
  for (const jc of queue) {
    if (!p.alive) return;
    if (!p.judge.some((x) => x.card === jc.card)) continue;
    G.moveCards([jc.card], { zone: 'processing' });
    const trickName = jc.as;
    s.resolving = { user: p.id, card: { ...G.usedCard([jc.card]), name: trickName }, targets: [p.id] };
    G.log({ type: 'delayed', actor: p.id, cards: [jc.card], text: `${CARD_DEFS[trickName].en} in ${G.n(p.id)}'s judgment area takes effect.` });
    const negated = yield* negateWindow(G, trickName, p.id, null);
    if (trickName === 'indulgence') {
      if (!negated) {
        const good = yield* judge(G, p.id, 'Indulgence', (c) => c.suit === 'heart', 'heart → escape');
        if (!good) {
          s.turn!.skipPlay = true;
          G.log({ type: 'effect', actor: p.id, text: `Indulgence: ${G.n(p.id)} will skip the Play phase.` });
        } else G.log({ type: 'effect', actor: p.id, text: `Indulgence failed — ${G.n(p.id)} plays normally.` });
      }
      if (s.processing.includes(jc.card)) yield* move(G, [jc.card], { zone: 'discard' });
    } else {
      let strike = false;
      if (!negated) {
        strike = yield* judge(G, p.id, 'Lightning', (c) => c.suit === 'spade' && c.rank >= 2 && c.rank <= 9, '♠2–9 → 3 damage');
      }
      if (strike) {
        G.log({ type: 'effect', actor: p.id, text: `Lightning strikes ${G.n(p.id)}!` });
        yield* damage(G, { source: null, target: p.id, amount: 3, card: { ...G.usedCard([jc.card]), name: 'lightning' }, nature: 'thunder' });
        if (s.processing.includes(jc.card)) yield* move(G, [jc.card], { zone: 'discard' });
      } else if (s.processing.includes(jc.card)) {
        passLightning(G, p, jc.card);
      }
    }
    s.resolving = null;
  }
}

function passLightning(G: Game, from: PlayerState, card: number) {
  let next = G.nextAliveAfter(from.id);
  const start = next.id;
  while (next.judge.some((j) => j.as === 'lightning')) {
    next = G.nextAliveAfter(next.id);
    if (next.id === start) break;
  }
  if (next.judge.some((j) => j.as === 'lightning')) {
    G.moveCards([card], { zone: 'discard' });
    return;
  }
  G.moveCards([card], { zone: 'judge', player: next.id, as: 'lightning' });
  G.log({ type: 'lightningMove', actor: from.id, targets: [next.id], cards: [card], text: `Lightning moves to ${G.n(next.id)}.` });
}

function* playPhase(G: Game, p: PlayerState): Flow<void> {
  while (p.alive) {
    const a = yield* ask<Answer>(G, {
      kind: 'play',
      players: [p.id],
      mode: 'single',
      prompt: 'Your Play phase: use cards or skills, then End Play Phase.',
      timeout: 'play',
    });
    if (a.type === 'end') break;
    if (a.type === 'useCard') {
      const card = G.usedCard(a.cardIds, a.as, a.skill);
      yield* useCard(G, p.id, card, a.targets, { countSlash: true });
    } else if (a.type === 'skill') {
      const impl = ACTIVE_SKILLS[a.skill];
      G.state.turn!.skillUses[a.skill] = (G.state.turn!.skillUses[a.skill] ?? 0) + 1;
      yield* impl.run(G, p, a.cardIds, a.targets);
    }
  }
}

function* discardPhase(G: Game, p: PlayerState): Flow<void> {
  const limit = Math.max(0, p.hp);
  const excess = p.hand.length - limit;
  if (excess <= 0) return;
  const a = yield* ask<Answer>(G, {
    kind: 'cards',
    players: [p.id],
    mode: 'single',
    prompt: `Discard phase: your hand limit is ${limit} (your current HP). Discard ${excess} card${excess === 1 ? '' : 's'}.`,
    timeout: 'response',
    min: excess,
    max: excess,
    selectable: [...p.hand],
    cancelable: false,
    confirmLabel: 'Discard',
  });
  const ids = (a as { cardIds: number[] }).cardIds;
  yield* discardCards(G, p.id, ids, 'discarded');
}

// ───────────────────────── using cards ─────────────────────────

export interface UseOpts {
  countSlash: boolean;
  /** Subcards are already in the processing zone (e.g. supplied through Jijiang). */
  alreadyInProcessing?: boolean;
  /** Lijian's Duel cannot be Negated. */
  unnegatable?: boolean;
}

export function* useCard(G: Game, userId: string, card: UsedCard, targets: string[], opts: UseOpts): Flow<void> {
  const s = G.state;
  const user = G.player(userId);
  const def = CARD_DEFS[card.name];
  const via = card.skill ? ` via ${card.skill}` : '';

  // Equipment
  const slot = equipSlotOf(card.name);
  if (slot && card.subcards.length === 1 && !card.skill) {
    const id = card.subcards[0];
    const old = user.equip[slot];
    G.log({ type: 'equip', actor: userId, cards: [id], text: `${G.n(userId)} equipped ${G.c(id)}.` });
    yield* afterLoss(G, G.moveCards([id], { zone: 'processing' }));
    if (old) {
      G.log({ type: 'discard', actor: userId, cards: [old], text: `${G.n(userId)}'s ${G.c(old)} was replaced and discarded.` });
      yield* move(G, [old], { zone: 'discard' });
    }
    G.moveCards([id], { zone: 'equip', player: userId });
    return;
  }

  // Delayed tricks (Lightning is always placed in the user's own judgment area)
  if (def.subtype === 'delayedTrick') {
    const target = card.name === 'lightning' ? userId : targets[0];
    G.log({
      type: 'useCard', actor: userId, targets: [target], cards: card.subcards,
      text: `${G.n(userId)} used ${G.usedName(card)}${via} → ${G.n(target)}.`, detail: { card: card.name },
    });
    yield* move(G, card.subcards, { zone: 'processing' });
    G.moveCards(card.subcards, { zone: 'judge', player: target, as: card.name as 'indulgence' | 'lightning' });
    return;
  }

  const prevResolving = s.resolving;
  if (!opts.alreadyInProcessing) yield* move(G, card.subcards, { zone: 'processing' });
  s.resolving = { user: userId, card, targets };
  G.log({
    type: 'useCard', actor: userId, targets, cards: card.subcards,
    text: `${G.n(userId)} used ${G.usedName(card)}${via}${targets.length ? ' → ' + targets.map((t) => G.n(t)).join(', ') : ''}.`,
    detail: { card: card.name },
  });

  if (card.name === 'slash') {
    if (opts.countSlash && s.turn?.player === userId) s.turn.slashUsed++;
    markSlash(G, userId);
  }
  if (isInstantTrick(card.name)) {
    for (const h of ownerHooks(G, user, 'onUseInstantTrick')) yield* h(G, user, card);
  }

  const effect = CARD_EFFECTS[card.name];
  if (effect) yield* effect(G, userId, card, targets, opts);

  if (card.subcards.some((id) => s.processing.includes(id))) {
    yield* move(G, card.subcards.filter((id) => s.processing.includes(id)), { zone: 'discard' });
  }
  s.resolving = prevResolving;
}

function markSlash(G: Game, pid: string) {
  const t = G.state.turn;
  if (t && t.player === pid && t.phase === 'play') t.slashUsedOrPlayedInPlay = true;
}

type CardEffect = (G: Game, user: string, card: UsedCard, targets: string[], opts: UseOpts) => Flow<void>;

const CARD_EFFECTS: Partial<Record<CardName, CardEffect>> = {
  slash: slashEffect,
  peach: function* (G, user) {
    recover(G, user, 1, user);
  },
  duel: function* (G, user, card, targets, opts) {
    const t = targets[0];
    if (!opts.unnegatable && (yield* negateWindow(G, 'duel', t, user))) return;
    yield* duelResolve(G, user, t, card);
  },
  exNihilo: function* (G, user) {
    if (yield* negateWindow(G, 'exNihilo', user, user)) return;
    yield* drawCards(G, user, 2);
  },
  dismantle: function* (G, user, _card, targets) {
    const t = G.player(targets[0]);
    if (yield* negateWindow(G, 'dismantle', t.id, user)) return;
    if (!t.alive || G.allCardsOf(t, ['hand', 'equip', 'judge']).length === 0) return;
    const id = yield* pickCardFrom(G, user, t.id, ['hand', 'equip', 'judge'], `Dismantle: choose a card of ${G.n(t.id)} to discard.`);
    if (id == null) return;
    G.log({ type: 'discard', actor: user, targets: [t.id], cards: [id], text: `${G.n(user)} dismantled ${G.c(id)} from ${G.n(t.id)}.` });
    yield* move(G, [id], { zone: 'discard' });
  },
  steal: function* (G, user, _card, targets) {
    const t = G.player(targets[0]);
    if (yield* negateWindow(G, 'steal', t.id, user)) return;
    if (!t.alive || G.allCardsOf(t, ['hand', 'equip', 'judge']).length === 0) return;
    const fromHand = (id: number) => t.hand.includes(id);
    const id = yield* pickCardFrom(G, user, t.id, ['hand', 'equip', 'judge'], `Steal: choose a card of ${G.n(t.id)} to take.`);
    if (id == null) return;
    yield* giveCards(G, t.id, user, [id], 'lost', !fromHand(id));
  },
  barbarians: function* (G, user, card) {
    yield* aoe(G, user, card, 'slash', 'play');
  },
  arrows: function* (G, user, card) {
    yield* aoe(G, user, card, 'dodge', 'use');
  },
  peachGarden: function* (G, user) {
    for (const p of G.seatOrderFrom(user)) {
      if (!p.alive || p.hp >= p.maxHp) continue;
      if (yield* negateWindow(G, 'peachGarden', p.id, user)) continue;
      recover(G, p.id, 1, user);
    }
  },
  harvest: function* (G, user) {
    const s = G.state;
    const order = G.seatOrderFrom(user);
    const ids = G.takeFromDeck(order.length);
    G.moveCards(ids, { zone: 'harvest' });
    G.log({ type: 'reveal', actor: user, cards: ids, text: `Bountiful Harvest reveals ${ids.map((i) => G.c(i)).join(', ')}.` });
    for (const p of order) {
      if (!s.harvest.length) break;
      if (!p.alive) continue;
      if (yield* negateWindow(G, 'harvest', p.id, user)) continue;
      const a = yield* ask<Answer>(G, {
        kind: 'harvest', players: [p.id], mode: 'single', timeout: 'response',
        prompt: 'Bountiful Harvest: choose one card to take.', cards: [...s.harvest],
      });
      const id = (a as { cardId: number }).cardId;
      G.log({ type: 'obtain', actor: p.id, cards: [id], text: `${G.n(p.id)} took ${G.c(id)}.` });
      G.moveCards([id], { zone: 'hand', player: p.id });
    }
    if (s.harvest.length) G.moveCards([...s.harvest], { zone: 'discard' });
  },
  borrowedSword: function* (G, user, _card, targets) {
    const [aId, bId] = targets;
    if (yield* negateWindow(G, 'borrowedSword', aId, user)) return;
    const a = G.player(aId);
    const b = G.player(bId);
    if (!a.alive || !a.equip.weapon) return;
    let slashed = false;
    if (b.alive && !slashTargetReason(G, a, b)) {
      const r = yield* requestCard(G, aId, 'slash', 'use',
        `${G.n(user)} used Borrowed Sword: use a Slash on ${G.n(bId)}, or give your weapon to ${G.n(user)}.`,
        { slashTarget: bId, keepInProcessing: true, cancelLabel: 'Give weapon' });
      if (r) {
        slashed = true;
        yield* useCard(G, aId, r, [bId], { countSlash: false, alreadyInProcessing: true });
      }
    }
    if (!slashed && a.alive && a.equip.weapon) {
      const w = a.equip.weapon;
      yield* giveCards(G, aId, user, [w], 'handed over', true);
    }
  },
};

// ───────────────────────── Slash ─────────────────────────

export interface SlashCtx {
  card: UsedCard;
  user: string;
  target: string;
  noDodge: boolean;
}

function* slashEffect(G: Game, userId: string, card: UsedCard, targets: string[]): Flow<void> {
  const user = G.player(userId);
  // "When you become the target of a Slash" — Liuli may redirect.
  const finalTargets: string[] = [];
  for (const t of targets) {
    let target = t;
    const tp = G.player(t);
    for (const h of ownerHooks(G, tp, 'onBecomeSlashTarget')) {
      const r = yield* h(G, tp, { user: userId, card, current: [...finalTargets, ...targets] });
      if (r) target = r;
    }
    finalTargets.push(target);
  }
  if (G.state.resolving) G.state.resolving = { ...G.state.resolving, targets: finalTargets };

  for (const t of finalTargets) {
    if (!user.alive) return;
    const target = G.player(t);
    if (!target.alive) continue;
    const ctx: SlashCtx = { card, user: userId, target: t, noDodge: false };
    // "After you target a character with a Slash": weapon & skill triggers of the user.
    for (const h of ownerHooks(G, user, 'afterSlashTarget')) yield* h(G, user, ctx);
    if (!target.alive || !user.alive) continue;
    yield* resolveSlashOn(G, ctx);
  }
}

export function slashIgnoresArmor(G: Game, userId: string): boolean {
  return weaponOf(G.player(userId)) === 'qinggang';
}

export function* resolveSlashOn(G: Game, ctx: SlashCtx): Flow<void> {
  const user = G.player(ctx.user);
  const target = G.player(ctx.target);
  // Renwang Shield: black Slash has no effect.
  if (armorOf(target) === 'renwangShield' && !slashIgnoresArmor(G, ctx.user) && ctx.card.color === 'black') {
    G.log({ type: 'effect', actor: ctx.target, text: `Renwang Shield: the black Slash has no effect on ${G.n(ctx.target)}.` });
    return;
  }
  let dodged = false;
  if (!ctx.noDodge) {
    const need = G.hasSkill(user, 'wushuang') ? 2 : 1;
    dodged = true;
    for (let i = 0; i < need; i++) {
      const prompt = need > 1
        ? `${G.n(ctx.user)} used Slash against you. Wushuang requires 2 Dodges. Play Dodge (${i}/${need}) or Pass.`
        : `${G.n(ctx.user)} used Slash against you. Use a Dodge or take damage.`;
      const r = yield* requestCard(G, ctx.target, 'dodge', 'use', prompt, { source: ctx.user, allowArmor: !slashIgnoresArmor(G, ctx.user) });
      if (!r) {
        dodged = false;
        break;
      }
      if (!target.alive) return;
    }
  } else {
    G.log({ type: 'effect', actor: ctx.user, targets: [ctx.target], text: `${G.n(ctx.target)} cannot Dodge this Slash.` });
  }
  if (dodged) {
    let forced = false;
    for (const h of ownerHooks(G, user, 'onSlashDodged')) {
      const r = yield* h(G, user, ctx);
      if (r === 'hit') {
        forced = true;
        break;
      }
      if (r === 'done') return;
    }
    if (!forced) return;
  }
  if (!target.alive) return;
  // Slash hits.
  let amount = 1;
  const t = G.state.turn;
  if (t?.luoyi && t.player === ctx.user && G.hasSkill(user, 'luoyi')) amount += 1;
  for (const h of ownerHooks(G, user, 'beforeSlashDamage')) {
    const r = yield* h(G, user, ctx);
    if (r === 'prevent') return;
  }
  if (!target.alive) return;
  yield* damage(G, { source: ctx.user, target: ctx.target, amount, card: ctx.card, nature: 'normal' });
}

// ───────────────────────── Duel / AoE ─────────────────────────

export function* duelResolve(G: Game, userId: string, targetId: string, card: UsedCard): Flow<void> {
  let responder = targetId;
  let other = userId;
  while (true) {
    const rp = G.player(responder);
    const op = G.player(other);
    if (!rp.alive || !op.alive) return;
    const need = G.hasSkill(op, 'wushuang') ? 2 : 1;
    let failed = false;
    for (let i = 0; i < need; i++) {
      const prompt = need > 1
        ? `Duel with ${G.n(other)}: Wushuang requires 2 Slashes. Play Slash (${i}/${need}) or take 1 damage.`
        : `Duel with ${G.n(other)}: play a Slash or take 1 damage.`;
      const r = yield* requestCard(G, responder, 'slash', 'play', prompt, { source: other });
      if (!r) {
        failed = true;
        break;
      }
    }
    if (failed) {
      let amount = 1;
      const t = G.state.turn;
      if (other === userId && t?.luoyi && t.player === userId && G.hasSkill(op, 'luoyi')) amount += 1;
      yield* damage(G, { source: other, target: responder, amount, card, nature: 'normal' });
      return;
    }
    [responder, other] = [other, responder];
  }
}

function* aoe(G: Game, userId: string, card: UsedCard, need: 'slash' | 'dodge', usage: 'use' | 'play'): Flow<void> {
  for (const p of G.seatOrderFrom(userId, false)) {
    if (!p.alive) continue;
    if (yield* negateWindow(G, card.name, p.id, userId)) continue;
    if (!p.alive) continue;
    const label = CARD_DEFS[card.name].en;
    const r = yield* requestCard(G, p.id, need, usage,
      `${G.n(userId)} used ${label}: play a ${need === 'slash' ? 'Slash' : 'Dodge'} or take 1 damage.`, { source: userId });
    if (!r && p.alive) yield* damage(G, { source: userId, target: p.id, amount: 1, card, nature: 'normal' });
    if (!G.player(userId).alive && G.state.turn?.player === userId) return;
  }
}

// ───────────────────────── Responses ─────────────────────────

export interface RequestOpts {
  source?: string;
  allowArmor?: boolean;
  /** Lord abilities (Hujia/Jijiang) available — false when answering on the lord's behalf. */
  allowLord?: boolean;
  keepInProcessing?: boolean;
  slashTarget?: string;
  cancelLabel?: string;
  /** Prevent Jijiang/Hujia recursion. */
  helping?: string;
}

/**
 * Ask a player to use/play a card (Dodge, Slash). Handles conversions, Eight Trigrams and lord
 * abilities. Returns the card used (already moved to discard unless keepInProcessing), or null.
 */
export function* requestCard(G: Game, pid: string, card: RespondCard, usage: 'use' | 'play', prompt: string, opts: RequestOpts = {}): Flow<UsedCard | null> {
  const p = G.player(pid);
  let armorTried = opts.allowArmor === false;
  let lordTried = opts.allowLord === false;
  while (p.alive) {
    const a = yield* ask<Answer>(G, {
      kind: 'respond',
      players: [pid],
      mode: 'single',
      prompt,
      timeout: 'response',
      card,
      usage,
      allowArmor: !armorTried,
      allowLordSkills: !lordTried,
      slashTarget: opts.slashTarget,
      cancelLabel: opts.cancelLabel,
      context: { source: opts.source, helping: opts.helping },
    } as Omit<RespondDecision, 'id'>);
    if (a.type === 'pass') return null;
    if (a.type === 'respondSkill') {
      if (a.skill === 'eightDiagrams') {
        armorTried = true;
        G.log({ type: 'skill', actor: pid, text: `${G.n(pid)} activated Eight Trigrams.`, detail: { skill: 'eightDiagrams' } });
        const red = yield* judge(G, pid, 'Eight Trigrams', (c) => suitColor(c.suit) === 'red', 'red → Dodge');
        if (red) {
          G.log({ type: 'respond', actor: pid, text: `${G.n(pid)} is treated as having played a Dodge (Eight Trigrams).`, detail: { card: 'dodge' } });
          return { name: 'dodge', subcards: [], suit: null, color: 'none', rank: null, skill: 'eightDiagrams' };
        }
        continue;
      }
      if (a.skill === 'hujia' || a.skill === 'jijiang') {
        lordTried = true;
        const kingdom = a.skill === 'hujia' ? 'wei' : 'shu';
        const what = a.skill === 'hujia' ? 'Dodge' : 'Slash';
        G.log({ type: 'skill', actor: pid, text: `${G.n(pid)} activated ${a.skill === 'hujia' ? 'Hujia' : 'Jijiang'}, asking ${kingdom === 'wei' ? 'Wei' : 'Shu'} characters for a ${what}.`, detail: { skill: a.skill } });
        for (const q of G.seatOrderFrom(pid, false)) {
          if (q.kingdom !== kingdom || !q.alive) continue;
          const r = yield* requestCard(G, q.id, card, usage,
            `${a.skill === 'hujia' ? 'Hujia' : 'Jijiang'}: the Lord ${G.n(pid)} asks you to play a ${what} on their behalf.`,
            { allowLord: false, helping: pid, keepInProcessing: opts.keepInProcessing, allowArmor: card === 'dodge' ? true : false });
          if (r) {
            G.log({ type: 'effect', actor: q.id, targets: [pid], text: `${G.n(q.id)} answered for ${G.n(pid)}.` });
            if (card === 'slash') markSlash(G, pid);
            return r;
          }
        }
        continue;
      }
      continue;
    }
    if (a.type === 'card') {
      const used = G.usedCard(a.cardIds, a.as, a.skill);
      const verb = usage === 'use' ? 'used' : 'played';
      G.log({
        type: 'respond', actor: pid, cards: a.cardIds,
        text: `${G.n(pid)} ${verb} ${G.usedName(used)}${a.skill ? ` via ${a.skill}` : ''}.`,
        detail: { card: used.name },
      });
      yield* move(G, a.cardIds, { zone: 'processing' });
      if (!opts.keepInProcessing) yield* move(G, a.cardIds.filter((id) => G.state.processing.includes(id)), { zone: 'discard' });
      if (used.name === 'slash') markSlash(G, pid);
      return used;
    }
    return null;
  }
  return null;
}

// ───────────────────────── Negate ─────────────────────────

export function* negateWindow(G: Game, trick: CardName, target: string | null, user: string | null): Flow<boolean> {
  let negated = false;
  let chain = 0;
  while (true) {
    const eligible = G.alivePlayers().filter((p) => p.hand.some((id) => getCard(id).name === 'negate'));
    if (!eligible.length) break;
    const what = chain === 0
      ? `${CARD_DEFS[trick].en}${user ? ` from ${G.n(user)}` : ''}${target ? ` on ${G.n(target)}` : ''}`
      : `the Negate (chain ${chain})`;
    const r = yield* ask<{ player: string; answer: Answer } | null>(G, {
      kind: 'negate',
      players: eligible.map((p) => p.id),
      mode: 'any',
      timeout: 'response',
      prompt: `${chain === 0 ? '' : 'Counter-negate? '}Use Negate against ${what}?`,
      context: { trick, target, user, chain, negated },
    });
    if (!r) break;
    const ans = r.answer as { cardIds: number[] };
    const id = ans.cardIds[0];
    const negUser = r.player;
    G.log({ type: 'useCard', actor: negUser, cards: [id], text: `${G.n(negUser)} used ${G.c(id)} against ${what}.`, detail: { card: 'negate' } });
    yield* move(G, [id], { zone: 'processing' });
    const np = G.player(negUser);
    for (const h of ownerHooks(G, np, 'onUseInstantTrick')) yield* h(G, np, G.usedCard([id]));
    if (G.state.processing.includes(id)) yield* move(G, [id], { zone: 'discard' });
    negated = !negated;
    chain++;
  }
  if (negated) G.log({ type: 'effect', text: `${CARD_DEFS[trick].en}${target ? ` on ${G.n(target)}` : ''} was negated.` });
  return negated;
}

// ───────────────────────── Judgment ─────────────────────────

export function* judge(
  G: Game,
  pid: string,
  reason: string,
  test: (c: PhysicalCard) => boolean,
  goodLabel: string,
  opts: { keepIf?: (c: PhysicalCard) => boolean } = {},
): Flow<boolean> {
  const s = G.state;
  let [card] = G.takeFromDeck(1);
  if (card === undefined) {
    G.state.winner = { side: 'draw', winners: [], reason: 'The deck is exhausted — the game is a draw.' };
    throw new GameOverSignal();
  }
  s.judgment = { player: pid, card, reason };
  G.log({ type: 'judge', actor: pid, cards: [card], text: `${G.n(pid)}'s judgment for ${reason}: ${G.c(card)}.`, detail: { reason, goodLabel } });
  // Before the judgment takes effect: Guicai (any character, in seat order from the current player).
  for (const q of G.seatOrderFrom(G.currentId())) {
    for (const h of ownerHooks(G, q, 'beforeJudgmentEffect')) {
      const replaced = yield* h(G, q, { player: pid, card, reason, goodLabel });
      if (replaced != null) {
        G.moveCards([card], { zone: 'discard' });
        card = replaced;
        s.judgment = { player: pid, card, reason };
      }
    }
  }
  const c = getCard(card);
  const good = test(c);
  G.log({ type: 'judgeResult', actor: pid, cards: [card], text: `Judgment result ${G.c(card)}: ${good ? 'succeeds' : 'fails'} (${goodLabel}).`, detail: { good } });
  s.judgment = null;
  // After the judgment takes effect.
  const owner = G.player(pid);
  if (opts.keepIf?.(c) && owner.alive && s.processing.includes(card)) {
    G.log({ type: 'obtain', actor: pid, cards: [card], text: `${G.n(pid)} obtained the judgment card ${G.c(card)}.` });
    G.moveCards([card], { zone: 'hand', player: pid });
  }
  if (s.processing.includes(card)) {
    for (const h of ownerHooks(G, owner, 'afterJudgment')) yield* h(G, owner, card);
  }
  if (s.processing.includes(card)) G.moveCards([card], { zone: 'discard' });
  return good;
}

// ───────────────────────── Damage / dying / death ─────────────────────────

export interface DamageInfo {
  source: string | null;
  target: string;
  amount: number;
  card?: UsedCard;
  nature: 'normal' | 'thunder';
}

export function* damage(G: Game, dmg: DamageInfo): Flow<void> {
  const t = G.player(dmg.target);
  if (!t.alive || dmg.amount <= 0) return;
  t.hp -= dmg.amount;
  G.log({
    type: 'damage',
    actor: dmg.source ?? undefined,
    targets: [dmg.target],
    text: `${G.n(dmg.target)} took ${dmg.amount} ${dmg.nature === 'thunder' ? 'thunder ' : ''}damage${dmg.source ? ` from ${G.n(dmg.source)}` : ''} (${t.hp}/${t.maxHp}).`,
    detail: { amount: dmg.amount, nature: dmg.nature },
  });
  if (t.hp <= 0) yield* dying(G, t, dmg.source);
  if (!t.alive) return;
  for (const h of ownerHooks(G, t, 'afterDamaged')) yield* h(G, t, dmg);
}

export function* loseHp(G: Game, pid: string, amount: number): Flow<void> {
  const t = G.player(pid);
  t.hp -= amount;
  G.log({ type: 'loseHp', actor: pid, text: `${G.n(pid)} lost ${amount} HP (${t.hp}/${t.maxHp}).`, detail: { amount } });
  if (t.hp <= 0) yield* dying(G, t, null);
}

export function canRescue(G: Game, q: PlayerState): boolean {
  if (q.hand.some((id) => getCard(id).name === 'peach')) return true;
  if (G.hasSkill(q, 'jijiu') && G.state.turn?.player !== q.id) {
    return G.allCardsOf(q).some((id) => suitColor(getCard(id).suit) === 'red');
  }
  return false;
}

export function* dying(G: Game, victim: PlayerState, killer: string | null): Flow<void> {
  G.log({ type: 'dying', actor: victim.id, text: `${G.n(victim.id)} is dying (HP ${victim.hp}) and needs ${1 - victim.hp} Peach${1 - victim.hp === 1 ? '' : 'es'}!` });
  // Rescue order: starting with the current turn player, in seat order.
  for (const q of G.seatOrderFrom(G.currentId())) {
    while (victim.hp <= 0 && q.alive && canRescue(G, q)) {
      const need = 1 - victim.hp;
      const a = yield* ask<Answer>(G, {
        kind: 'respond', players: [q.id], mode: 'single', timeout: 'response',
        card: 'peach', usage: 'use', target: victim.id,
        prompt: q.id === victim.id
          ? `You are dying (HP ${victim.hp}). Use a Peach on yourself? (${need} needed)`
          : `${G.n(victim.id)} is dying (HP ${victim.hp}) and needs ${need} Peach${need === 1 ? '' : 'es'}. Use a Peach to save them?`,
        context: { dying: victim.id },
      } as Omit<RespondDecision, 'id'>);
      if (a.type !== 'card') break;
      const used = G.usedCard(a.cardIds, a.as, a.skill);
      G.log({ type: 'useCard', actor: q.id, targets: [victim.id], cards: a.cardIds, text: `${G.n(q.id)} used ${G.usedName(used)}${a.skill ? ` via ${a.skill}` : ''} on ${G.n(victim.id)}.`, detail: { card: 'peach' } });
      yield* move(G, a.cardIds, { zone: 'processing' });
      let amount = 1;
      if (G.hasSkill(victim, 'jiuyuan') && q.id !== victim.id && q.kingdom === 'wu') {
        amount = 2;
        G.log({ type: 'skill', actor: victim.id, text: `Jiuyuan: the Peach from a Wu character restores 1 extra HP.`, detail: { skill: 'jiuyuan' } });
      }
      recover(G, victim.id, amount, q.id);
      yield* move(G, a.cardIds.filter((id) => G.state.processing.includes(id)), { zone: 'discard' });
    }
    if (victim.hp > 0) return;
  }
  if (victim.hp <= 0) yield* death(G, victim, killer);
}

export function* death(G: Game, victim: PlayerState, killer: string | null): Flow<void> {
  const s = G.state;
  victim.alive = false;
  victim.roleRevealed = true;
  G.log({
    type: 'death', actor: victim.id, targets: killer ? [killer] : undefined,
    text: `${G.n(victim.id)} (${victim.name}) died${killer ? `, killed by ${G.n(killer)}` : ''}, and was revealed as ${ROLE_INFO[victim.role].en} (${ROLE_INFO[victim.role].zh}).`,
    detail: { role: victim.role },
  });
  const cards = G.allCardsOf(victim, ['hand', 'equip', 'judge']);
  if (cards.length) G.moveCards(cards, { zone: 'discard' });

  const win = checkVictory(s.players);
  if (win) {
    s.winner = win;
    throw new GameOverSignal();
  }
  if (killer) {
    const k = G.player(killer);
    if (k.alive && victim.role === 'rebel') {
      G.log({ type: 'reward', actor: killer, text: `${G.n(killer)} killed a Rebel and draws 3 cards as a reward.` });
      yield* drawCards(G, killer, 3);
    }
    if (k.alive && victim.role === 'loyalist' && k.role === 'lord') {
      const all = G.allCardsOf(k, ['hand', 'equip']);
      G.log({ type: 'penalty', actor: killer, text: `The Lord killed a Loyalist and must discard all hand and equipment cards.` });
      if (all.length) yield* discardCards(G, killer, all, 'discarded (penalty)');
    }
  }
  if (s.turn?.player === victim.id) throw new TurnEndSignal();
}

// ───────────────────────── pick a card from a player ─────────────────────────

/** Choose one card from another player's areas. Hand cards are chosen blindly (random). */
export function* pickCardFrom(G: Game, chooser: string, targetId: string, zones: ('hand' | 'equip' | 'judge')[], prompt: string, cancelable = false): Flow<number | null> {
  const t = G.player(targetId);
  const avail = zones.filter((z) => G.allCardsOf(t, [z]).length > 0);
  if (!avail.length) return null;
  const a = yield* ask<Answer>(G, {
    kind: 'pickCard', players: [chooser], mode: 'single', timeout: 'response',
    prompt, target: targetId, zones: avail, cancelable,
  });
  if (a.type === 'pass') return null;
  if (a.type === 'pick' && 'zone' in a) {
    return G.rng.pick(t.hand);
  }
  return (a as { cardId: number }).cardId;
}

export { GameOverSignal, TurnEndSignal };
export type { RespondCard };
