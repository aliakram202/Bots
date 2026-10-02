import { ALL_CARDS, cardLabel, deckCardIds, getCard, suitColor } from '../cards/deck';
import { CARD_DEFS, equipSlotOf } from '../cards/definitions';
import { generalDef } from '../generals/definitions';
import { Rng } from './rng';
import type {
  Answer,
  CardName,
  Decision,
  EquipSlot,
  GameConfig,
  GameState,
  LogEntry,
  PlayerState,
  UsedCard,
} from './types';
import { mainFlow } from './flows';
import { validateAnswer, defaultAnswer } from './legal';

export class GameOverSignal extends Error {
  constructor() {
    super('game over');
  }
}
export class TurnEndSignal extends Error {
  constructor() {
    super('turn end');
  }
}

export type CardLocation =
  | { zone: 'hand' | 'equip' | 'judge'; player: string }
  | { zone: 'draw' | 'discard' | 'processing' | 'harvest' };

export type Destination =
  | { zone: 'hand'; player: string }
  | { zone: 'equip'; player: string }
  | { zone: 'judge'; player: string; as: 'indulgence' | 'lightning' }
  | { zone: 'discard' }
  | { zone: 'processing' }
  | { zone: 'harvest' }
  | { zone: 'drawTop' }
  | { zone: 'drawBottom' };

export interface LossInfo {
  player: string;
  handBefore: number;
  handLost: number[];
  equipLost: number[];
}

export interface Command {
  seq: number;
  player: string;
  answer: Answer;
}

/** Hidden server-side decision extras (never serialized to clients). */
export interface DecisionExtras {
  check?: (answer: Answer, player: string) => string | null;
}

export type PendingDecision = Decision & DecisionExtras;

export class Game {
  state: GameState;
  rng: Rng;
  config: GameConfig;
  pending: PendingDecision | null = null;
  /** Answers collected for 'all'/'any' decisions. */
  collected: Record<string, Answer> = {};
  commands: Command[] = [];
  /** Per-player preference: auto-use optional skills that only benefit the owner. */
  autoUse: Record<string, boolean> = {};
  private decisionSeq = 0;
  private logSeq = 0;
  private gen: Generator<Decision, void, any>;
  error: string | null = null;

  constructor(config: GameConfig) {
    this.config = config;
    this.rng = new Rng(config.seed);
    const ids = deckCardIds(config.includeEx !== false);
    this.state = {
      status: 'selecting',
      players: config.playerIds.map((id, seat) => ({
        id,
        seat,
        name: config.playerNames[id] ?? id,
        role: 'rebel',
        roleRevealed: false,
        general: null,
        kingdom: null,
        gender: null,
        hp: 0,
        maxHp: 0,
        alive: true,
        hand: [],
        equip: {},
        judge: [],
        bot: config.bots?.includes(id) ?? false,
      })),
      drawPile: this.rng.shuffle([...ids]),
      discardPile: [],
      processing: [],
      harvest: [],
      judgment: null,
      resolving: null,
      turn: null,
      round: 0,
      winner: null,
      log: [],
      deckSize: ids.length,
    };
    for (const id of config.playerIds) this.autoUse[id] = config.autoUseDefault ?? true;
    this.gen = mainFlow(this);
    this.advance(undefined);
  }

  // ───────────── decision plumbing ─────────────

  nextDecisionId(): number {
    return ++this.decisionSeq;
  }

  private advance(input: unknown) {
    try {
      const r = this.gen.next(input);
      if (r.done) {
        this.pending = null;
      } else {
        this.pending = r.value as PendingDecision;
        this.collected = {};
      }
    } catch (e) {
      this.pending = null;
      this.error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
      // Rethrow so tests and the server notice engine bugs loudly.
      throw e;
    }
  }

  /** Submit an answer for the pending decision. Returns an error string if illegal. */
  dispatch(player: string, answer: Answer): string | null {
    const d = this.pending;
    if (!d) return 'No decision is pending.';
    if (!d.players.includes(player)) return 'It is not your decision.';
    if (d.mode !== 'single' && this.collected[player]) return 'You already answered.';
    if (answer.type === 'timeout') answer = defaultAnswer(this, d, player);
    const err = validateAnswer(this, d, player, answer);
    if (err) return err;
    if (d.check) {
      const e2 = d.check(answer, player);
      if (e2) return e2;
    }
    this.commands.push({ seq: this.commands.length + 1, player, answer });
    if (d.mode === 'single') {
      this.advance(answer);
    } else if (d.mode === 'all') {
      this.collected[player] = answer;
      if (d.players.every((p) => this.collected[p])) this.advance({ ...this.collected });
    } else {
      // 'any': first non-pass answer wins
      if (answer.type !== 'pass') {
        this.advance({ player, answer });
      } else {
        this.collected[player] = answer;
        if (d.players.every((p) => this.collected[p])) this.advance(null);
      }
    }
    return null;
  }

  /** Change a player's auto-use preference; recorded so replays stay deterministic. */
  setAutoUse(pid: string, value: boolean) {
    this.autoUse[pid] = value;
    this.commands.push({ seq: this.commands.length + 1, player: '__pref__', answer: { pid, value } as unknown as Answer });
  }

  /** Players who still have to answer the pending decision. */
  waitingOn(): string[] {
    const d = this.pending;
    if (!d) return [];
    if (d.mode === 'single') return [...d.players];
    return d.players.filter((p) => !this.collected[p]);
  }

  // ───────────── queries ─────────────

  player(id: string): PlayerState {
    const p = this.state.players.find((x) => x.id === id);
    if (!p) throw new Error(`Unknown player ${id}`);
    return p;
  }

  alivePlayers(): PlayerState[] {
    return this.state.players.filter((p) => p.alive);
  }

  /** Alive players in seat order starting from `fromId` (inclusive). */
  seatOrderFrom(fromId: string, includeSelf = true): PlayerState[] {
    const n = this.state.players.length;
    const start = this.player(fromId).seat;
    const out: PlayerState[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.state.players[(start + i) % n];
      if (!p.alive) continue;
      if (!includeSelf && p.id === fromId) continue;
      out.push(p);
    }
    return out;
  }

  /** Current turn player id (or lord before turns start). */
  currentId(): string {
    return this.state.turn?.player ?? this.state.players.find((p) => p.role === 'lord')?.id ?? this.state.players[0].id;
  }

  /** Next living player after `id` in seat order (works even if `id` is dead). */
  nextAliveAfter(id: string): PlayerState {
    const ps = this.state.players;
    const n = ps.length;
    const start = this.player(id).seat;
    for (let i = 1; i <= n; i++) {
      const p = ps[(start + i) % n];
      if (p.alive) return p;
    }
    return this.player(id);
  }

  card(id: number) {
    return getCard(id);
  }

  allCardsOf(p: PlayerState, zones: ('hand' | 'equip' | 'judge')[] = ['hand', 'equip']): number[] {
    const out: number[] = [];
    if (zones.includes('hand')) out.push(...p.hand);
    if (zones.includes('equip')) out.push(...(Object.values(p.equip) as number[]));
    if (zones.includes('judge')) out.push(...p.judge.map((j) => j.card));
    return out;
  }

  equipped(p: PlayerState, slot: EquipSlot): CardName | null {
    const id = p.equip[slot];
    return id ? getCard(id).name : null;
  }

  hasSkill(p: PlayerState | string, skill: string): boolean {
    const pl = typeof p === 'string' ? this.player(p) : p;
    if (!pl.general || !pl.alive) return false;
    const def = generalDef(pl.general);
    if (!def.skills.includes(skill)) return false;
    // Lord skills only work for the player whose role is Lord.
    if (['hujia', 'jijiang', 'jiuyuan'].includes(skill) && pl.role !== 'lord') return false;
    return true;
  }

  // ───────────── names / logging ─────────────

  n(id: string): string {
    const p = this.player(id);
    return p.general ? generalDef(p.general).en : p.name;
  }

  c(id: number): string {
    const card = getCard(id);
    return `${CARD_DEFS[card.name].en} ${cardLabel(card)}`;
  }

  usedName(card: UsedCard): string {
    const def = CARD_DEFS[card.name];
    if (card.subcards.length === 1 && !card.skill) return this.c(card.subcards[0]);
    if (card.subcards.length === 0) return def.en;
    return `${def.en} (${card.subcards.map((x) => this.c(x)).join(' + ')})`;
  }

  log(entry: Omit<LogEntry, 'id'>): LogEntry {
    const e: LogEntry = { id: ++this.logSeq, ...entry };
    this.state.log.push(e);
    if (this.state.log.length > 400) this.state.log.splice(0, this.state.log.length - 400);
    return e;
  }

  // ───────────── card movement primitives ─────────────

  locate(id: number): CardLocation | null {
    const s = this.state;
    for (const p of s.players) {
      if (p.hand.includes(id)) return { zone: 'hand', player: p.id };
      if (Object.values(p.equip).includes(id)) return { zone: 'equip', player: p.id };
      if (p.judge.some((j) => j.card === id)) return { zone: 'judge', player: p.id };
    }
    if (s.drawPile.includes(id)) return { zone: 'draw' };
    if (s.discardPile.includes(id)) return { zone: 'discard' };
    if (s.processing.includes(id)) return { zone: 'processing' };
    if (s.harvest.includes(id)) return { zone: 'harvest' };
    return null;
  }

  private removeCard(id: number): CardLocation {
    const loc = this.locate(id);
    if (!loc) throw new Error(`Card ${id} is nowhere`);
    const s = this.state;
    const rm = (arr: number[]) => {
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
    };
    switch (loc.zone) {
      case 'hand':
        rm(this.player(loc.player).hand);
        break;
      case 'equip': {
        const p = this.player(loc.player);
        for (const k of Object.keys(p.equip) as EquipSlot[]) if (p.equip[k] === id) delete p.equip[k];
        break;
      }
      case 'judge': {
        const p = this.player(loc.player);
        p.judge = p.judge.filter((j) => j.card !== id);
        break;
      }
      case 'draw':
        rm(s.drawPile);
        break;
      case 'discard':
        rm(s.discardPile);
        break;
      case 'processing':
        rm(s.processing);
        break;
      case 'harvest':
        rm(s.harvest);
        break;
    }
    return loc;
  }

  /**
   * Synchronously move cards and report which players lost hand/equipment cards.
   * Skill triggers on loss (Lianying, Xiaoji) are run by the `move` flow in flows.ts.
   */
  moveCards(ids: number[], dest: Destination): LossInfo[] {
    const losses = new Map<string, LossInfo>();
    for (const id of ids) {
      const before = this.locate(id);
      if (before && (before.zone === 'hand' || before.zone === 'equip')) {
        const p = this.player(before.player);
        if (!losses.has(p.id)) losses.set(p.id, { player: p.id, handBefore: p.hand.length, handLost: [], equipLost: [] });
        const info = losses.get(p.id)!;
        if (before.zone === 'hand') info.handLost.push(id);
        else info.equipLost.push(id);
      }
      this.removeCard(id);
      const s = this.state;
      switch (dest.zone) {
        case 'hand':
          this.player(dest.player).hand.push(id);
          break;
        case 'equip': {
          const slot = equipSlotOf(getCard(id).name);
          if (!slot) throw new Error('not equipment');
          this.player(dest.player).equip[slot] = id;
          break;
        }
        case 'judge':
          this.player(dest.player).judge.push({ card: id, as: dest.as });
          break;
        case 'discard':
          s.discardPile.push(id);
          break;
        case 'processing':
          s.processing.push(id);
          break;
        case 'harvest':
          s.harvest.push(id);
          break;
        case 'drawTop':
          s.drawPile.unshift(id);
          break;
        case 'drawBottom':
          s.drawPile.push(id);
          break;
      }
    }
    return [...losses.values()].filter((l) => l.handLost.length || l.equipLost.length);
  }

  /** Take n cards from the top of the draw pile, reshuffling the discard pile when needed. */
  takeFromDeck(n: number): number[] {
    const s = this.state;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      if (s.drawPile.length === 0) {
        if (s.discardPile.length === 0) break;
        s.drawPile = this.rng.shuffle([...s.discardPile]);
        s.discardPile = [];
        this.log({ type: 'shuffle', text: 'The discard pile was shuffled to form a new deck.' });
      }
      out.push(s.drawPile[0]);
      // keep the card in the draw pile until moved, so locate() works
      s.drawPile.shift();
      s.processing.push(out[out.length - 1]);
    }
    return out;
  }

  usedCard(ids: number[], as?: CardName, skill?: string): UsedCard {
    if (ids.length === 1 && !as) {
      const c = getCard(ids[0]);
      return { name: c.name, subcards: ids, suit: c.suit, color: suitColor(c.suit), rank: c.rank };
    }
    if (ids.length === 1) {
      const c = getCard(ids[0]);
      return { name: as!, subcards: ids, suit: c.suit, color: suitColor(c.suit), rank: c.rank, skill };
    }
    const colors = new Set(ids.map((i) => suitColor(getCard(i).suit)));
    const suits = new Set(ids.map((i) => getCard(i).suit));
    return {
      name: as!,
      subcards: ids,
      suit: suits.size === 1 ? [...suits][0] : null,
      color: colors.size === 1 ? [...colors][0] : 'none',
      rank: null,
      skill,
    };
  }

  /** Card conservation invariant: every card exists in exactly one zone. */
  checkInvariants(): string | null {
    const seen = new Map<number, number>();
    const add = (id: number) => seen.set(id, (seen.get(id) ?? 0) + 1);
    const s = this.state;
    for (const p of s.players) {
      p.hand.forEach(add);
      Object.values(p.equip).forEach((x) => add(x as number));
      p.judge.forEach((j) => add(j.card));
      if (p.hp > p.maxHp) return `${p.id} hp ${p.hp} > max ${p.maxHp}`;
      if (!p.alive && (p.hand.length || Object.keys(p.equip).length || p.judge.length)) return `dead ${p.id} holds cards`;
    }
    s.drawPile.forEach(add);
    s.discardPile.forEach(add);
    s.processing.forEach(add);
    s.harvest.forEach(add);
    if (seen.size !== s.deckSize) return `card count ${seen.size} != ${s.deckSize}`;
    for (const [id, cnt] of seen) if (cnt !== 1) return `card ${id} appears ${cnt} times`;
    return null;
  }
}

export function allCardIds(): number[] {
  return ALL_CARDS.map((c) => c.id);
}
