// Player-specific sanitized views. This is the hidden-information boundary:
// nothing returned here may reveal another player's hand cards, secret role,
// private choices, or the draw-pile order.

import type { Game } from './game';
import { negateOptions, playOptions, respondOptions } from './legal';
import type {
  EquipSlot,
  GameState,
  JudgeAreaCard,
  Phase,
  PlayOption,
  RespondOptions,
  Role,
  TargetSpec,
  UsedCard,
  WinnerInfo,
} from './types';

export interface PublicPlayer {
  id: string;
  seat: number;
  name: string;
  general: string | null;
  kingdom: string | null;
  gender: string | null;
  hp: number;
  maxHp: number;
  alive: boolean;
  handCount: number;
  /** Only present for the viewer themself. */
  hand?: number[];
  equip: Partial<Record<EquipSlot, number>>;
  judge: JudgeAreaCard[];
  /** Known role (own role, the Lord, dead players, or everyone after the game). */
  role: Role | null;
  bot: boolean;
}

export interface ViewLogEntry {
  id: number;
  type: string;
  text: string;
  actor?: string;
  targets?: string[];
  cards?: number[];
  detail?: Record<string, unknown>;
  private?: boolean;
}

export interface DecisionView {
  id: number;
  kind: string;
  prompt: string;
  /** Who we are waiting on (hidden for Negate windows to avoid leaking who holds a Negate). */
  waitingOn: string[] | null;
  /** True when the viewer must/may answer. */
  mine: boolean;
  timeout: string;
  context?: Record<string, unknown>;
  // Payload only for deciders:
  playOptions?: PlayOption[];
  respond?: RespondOptions & { card: string; usage: string; target?: string; slashTarget?: string; cancelLabel?: string };
  negateCards?: number[];
  cards?: { min: number; max: number; selectable: number[]; cancelable: boolean; targets?: TargetSpec | { min: number; max: number; valid: string[] }; confirmLabel?: string };
  pick?: { target: string; zones: string[]; cancelable: boolean; handCount: number; equip: number[]; judge: number[] };
  players?: { min: number; max: number; valid: string[]; cancelable: boolean };
  options?: { id: string; label: string }[];
  revealed?: number[];
  validRecipients?: string[];
  generals?: string[];
}

export interface GameView {
  viewer: string | null;
  status: GameState['status'];
  players: PublicPlayer[];
  drawCount: number;
  discardCount: number;
  discardTop: number[];
  processing: number[];
  harvest: number[];
  judgment: GameState['judgment'];
  resolving: { user: string; card: UsedCard; targets: string[] } | null;
  turn: { player: string; phase: Phase; round: number; slashUsed: number } | null;
  winner: WinnerInfo | null;
  log: ViewLogEntry[];
  decision: DecisionView | null;
  autoUse: boolean;
  /** Lord's id, for convenience. */
  lord: string | null;
}

export function viewFor(G: Game, viewer: string | null, logLimit = 150): GameView {
  const s = G.state;
  const finished = s.status === 'finished';
  const players: PublicPlayer[] = s.players.map((p) => {
    const self = p.id === viewer;
    return {
      id: p.id,
      seat: p.seat,
      name: p.name,
      general: p.general,
      kingdom: p.kingdom,
      gender: p.gender,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      handCount: p.hand.length,
      ...(self || (finished && viewer) ? { hand: [...p.hand] } : {}),
      equip: { ...p.equip },
      judge: p.judge.map((j) => ({ ...j })),
      role: self || p.roleRevealed || finished ? p.role : null,
      bot: !!p.bot,
    };
  });

  const log: ViewLogEntry[] = [];
  for (const e of s.log.slice(-logLimit)) {
    const priv = viewer ? e.private?.[viewer] : undefined;
    if (priv) {
      log.push({ id: e.id, type: e.type, text: priv.text, actor: e.actor, targets: e.targets, cards: priv.cards, detail: e.detail, private: true });
    } else if (e.text) {
      log.push({ id: e.id, type: e.type, text: e.text, actor: e.actor, targets: e.targets, cards: e.cards, detail: e.detail });
    }
  }

  return {
    viewer,
    status: s.status,
    players,
    drawCount: s.drawPile.length,
    discardCount: s.discardPile.length,
    discardTop: s.discardPile.slice(-6),
    processing: [...s.processing],
    harvest: [...s.harvest],
    judgment: s.judgment ? { ...s.judgment } : null,
    resolving: s.resolving ? { ...s.resolving, card: { ...s.resolving.card } } : null,
    turn: s.turn ? { player: s.turn.player, phase: s.turn.phase, round: s.round, slashUsed: s.turn.slashUsed } : null,
    winner: s.winner,
    log,
    decision: decisionView(G, viewer),
    autoUse: viewer ? G.autoUse[viewer] ?? true : true,
    lord: s.players.find((p) => p.role === 'lord')?.id ?? null,
  };
}

function decisionView(G: Game, viewer: string | null): DecisionView | null {
  const d = G.pending;
  if (!d) return null;
  const waiting = G.waitingOn();
  const mine = !!viewer && waiting.includes(viewer);
  const base: DecisionView = {
    id: d.id,
    kind: d.kind,
    prompt: mine ? d.prompt : publicPrompt(G, d.kind, waiting),
    waitingOn: d.kind === 'negate' ? null : waiting,
    mine,
    timeout: d.timeout,
    context: mine ? d.context : undefined,
  };
  if (!mine || !viewer) return base;
  switch (d.kind) {
    case 'play':
      base.playOptions = playOptions(G, viewer);
      break;
    case 'respond':
      base.respond = { ...respondOptions(G, viewer, d), card: d.card, usage: d.usage, target: d.target, slashTarget: d.slashTarget, cancelLabel: d.cancelLabel };
      break;
    case 'negate':
      base.negateCards = negateOptions(G, viewer);
      base.context = { ...d.context };
      break;
    case 'cards':
      base.cards = { min: d.min, max: d.max, selectable: d.selectable, cancelable: d.cancelable, targets: d.targets, confirmLabel: d.confirmLabel };
      break;
    case 'pickCard': {
      const t = G.player(d.target);
      base.pick = {
        target: d.target, zones: d.zones, cancelable: d.cancelable, handCount: t.hand.length,
        equip: d.zones.includes('equip') ? (Object.values(t.equip) as number[]) : [],
        judge: d.zones.includes('judge') ? t.judge.map((j) => j.card) : [],
      };
      break;
    }
    case 'players':
      base.players = { min: d.min, max: d.max, valid: d.valid, cancelable: d.cancelable };
      break;
    case 'option':
      base.options = d.options;
      break;
    case 'guanxing':
    case 'harvest':
      base.revealed = d.cards;
      break;
    case 'yiji':
      base.revealed = d.cards;
      base.validRecipients = d.valid;
      break;
    case 'chooseGeneral':
      base.generals = d.options[viewer];
      break;
  }
  return base;
}

function publicPrompt(G: Game, kind: string, waiting: string[]): string {
  if (kind === 'negate') return 'Waiting to see if anyone uses Negate…';
  if (kind === 'chooseGeneral') return `Waiting for ${waiting.length} player(s) to choose a general…`;
  const who = waiting.map((w) => G.n(w)).join(', ');
  switch (kind) {
    case 'play':
      return `${who} is in the Play phase…`;
    case 'respond':
      return `Waiting for ${who} to respond…`;
    default:
      return `Waiting for ${who}…`;
  }
}
