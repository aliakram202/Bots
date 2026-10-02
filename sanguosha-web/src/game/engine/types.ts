// Core types of the San Guo Sha rules engine.
// The engine is pure TypeScript: no React, no network, no Date.now(), no Math.random().

export type Suit = 'spade' | 'heart' | 'club' | 'diamond';
export type Color = 'red' | 'black' | 'none';
export type Kingdom = 'wei' | 'shu' | 'wu' | 'qun';
export type Gender = 'male' | 'female';
export type Role = 'lord' | 'loyalist' | 'rebel' | 'renegade';

export type CardCategory = 'basic' | 'trick' | 'equipment';
export type CardSubtype =
  | 'basic'
  | 'instantTrick'
  | 'delayedTrick'
  | 'weapon'
  | 'armor'
  | 'horsePlus'
  | 'horseMinus';
export type EquipSlot = 'weapon' | 'armor' | 'horsePlus' | 'horseMinus';

export type BasicName = 'slash' | 'dodge' | 'peach';
export type TrickName =
  | 'duel'
  | 'dismantle'
  | 'steal'
  | 'exNihilo'
  | 'barbarians'
  | 'arrows'
  | 'peachGarden'
  | 'harvest'
  | 'borrowedSword'
  | 'negate'
  | 'indulgence'
  | 'lightning';
export type WeaponName =
  | 'crossbow'
  | 'qinggang'
  | 'doubleSwords'
  | 'iceSword'
  | 'greenDragon'
  | 'serpentSpear'
  | 'axe'
  | 'halberd'
  | 'kylinBow';
export type ArmorName = 'eightDiagrams' | 'renwangShield';
export type HorseName = 'jueying' | 'dilu' | 'zhuahuang' | 'chitu' | 'dayuan' | 'zixing';
export type CardName = BasicName | TrickName | WeaponName | ArmorName | HorseName;

/** One physical card in the deck. Suit/rank are fixed by the Standard deck table. */
export interface PhysicalCard {
  id: number;
  name: CardName;
  suit: Suit;
  rank: number; // 1 (A) .. 13 (K)
  ex?: boolean;
}

/** A card as it is being used/played: may be a real card or a virtual conversion. */
export interface UsedCard {
  name: CardName;
  subcards: number[];
  suit: Suit | null;
  color: Color;
  rank: number | null;
  /** Skill or equipment that converted the subcards into this card (e.g. 'wusheng'). */
  skill?: string;
}

export type Phase = 'start' | 'judgment' | 'draw' | 'play' | 'discard' | 'end';
export const PHASES: Phase[] = ['start', 'judgment', 'draw', 'play', 'discard', 'end'];

export interface JudgeAreaCard {
  card: number;
  as: 'indulgence' | 'lightning';
}

export interface PlayerState {
  id: string;
  seat: number;
  name: string;
  role: Role;
  roleRevealed: boolean;
  general: string | null;
  kingdom: Kingdom | null;
  gender: Gender | null;
  hp: number;
  maxHp: number;
  alive: boolean;
  hand: number[];
  equip: Partial<Record<EquipSlot, number>>;
  judge: JudgeAreaCard[];
  /** Whether the seat is controlled by the server bot. */
  bot?: boolean;
}

export interface TurnState {
  player: string;
  phase: Phase;
  slashUsed: number;
  /** Did the player use or play a Slash during this turn's Play phase (for Keji). */
  slashUsedOrPlayedInPlay: boolean;
  skillUses: Record<string, number>;
  luoyi: boolean;
  rendeGiven: number;
  rendeHealed: boolean;
  skipPlay: boolean;
  skipDiscard: boolean;
}

export interface WinnerInfo {
  side: 'lord' | 'rebel' | 'renegade' | 'draw';
  winners: string[];
  reason: string;
}

export interface LogCardRef {
  id: number;
}

export interface LogEntry {
  id: number;
  type: string;
  text: string;
  actor?: string;
  targets?: string[];
  /** Card ids that are public information for this event. */
  cards?: number[];
  /** Per-player replacement text/cards (e.g. private draws). */
  private?: Record<string, { text: string; cards?: number[] }>;
  detail?: Record<string, unknown>;
  /** Technical info for debugging; only shown when requested. */
  tech?: string;
}

export interface GameState {
  status: 'selecting' | 'playing' | 'finished';
  players: PlayerState[];
  drawPile: number[];
  discardPile: number[];
  /** Cards currently being resolved (in the "processing area"). */
  processing: number[];
  /** Cards revealed by Harvest awaiting picks. */
  harvest: number[];
  /** Currently revealed judgment card (public). */
  judgment: { player: string; card: number; reason: string } | null;
  /** The card currently being resolved, for the battlefield display. */
  resolving: { user: string; card: UsedCard; targets: string[] } | null;
  turn: TurnState | null;
  round: number;
  winner: WinnerInfo | null;
  log: LogEntry[];
  /** Total number of game cards in this deck (for invariant checks). */
  deckSize: number;
}

export interface GameConfig {
  playerIds: string[];
  playerNames: Record<string, string>;
  seed: [number, number, number, number];
  /** Role distribution variant. */
  roleVariant?: 'standard' | 'doubleRenegade';
  includeEx?: boolean;
  /** Number of generals offered to non-lord players. */
  generalChoices?: number;
  bots?: string[];
  /** Initial auto-use preference for optional beneficial skills (default true). */
  autoUseDefault?: boolean;
  /** Debug scenario: skip role/general selection and use fixed setup. */
  scenario?: Scenario;
}

export interface Scenario {
  roles?: Record<string, Role>;
  generals?: Record<string, string>;
  hp?: Record<string, number>;
  /** Card names (or ids) placed into hands; the rest of the deck is shuffled. */
  hands?: Record<string, (CardName | number)[]>;
  equips?: Record<string, (CardName | number)[]>;
  judges?: Record<string, ('indulgence' | 'lightning' | number)[]>;
  /** Cards placed on top of the draw pile in order (first = top). */
  deckTop?: (CardName | number)[];
  startPlayer?: string;
  /** Deal the normal 4 starting cards in addition to scenario hands. */
  dealStartingHands?: boolean;
}

// ───────────────────────── Decisions ─────────────────────────

export type RespondCard = 'slash' | 'dodge' | 'peach' | 'negate';

export interface DecisionBase {
  id: number;
  /** Players who may/must answer. */
  players: string[];
  /** single: one player; any: first 'use' wins (all must pass otherwise); all: everyone answers. */
  mode: 'single' | 'any' | 'all';
  prompt: string;
  /** Hint for the client UI about which context the prompt is in. */
  context?: Record<string, unknown>;
  timeout: 'play' | 'response' | 'select';
}

export interface ChooseGeneralDecision extends DecisionBase {
  kind: 'chooseGeneral';
  options: Record<string, string[]>;
}
export interface PlayDecision extends DecisionBase {
  kind: 'play';
}
export interface RespondDecision extends DecisionBase {
  kind: 'respond';
  card: RespondCard;
  /** 'use' (使用) vs 'play' (打出) — matters for some skills. */
  usage: 'use' | 'play';
  /** For dying rescue: whose life is at stake. */
  target?: string;
  /** Lord abilities are not offered when a vassal answers on the lord's behalf. */
  allowLordSkills?: boolean;
  /** Eight Diagrams cannot be re-tried after failing. */
  allowArmor?: boolean;
  /** Fixed slash target when this response is a Slash *use* (Borrowed Sword, Green Dragon). */
  slashTarget?: string;
  cancelLabel?: string;
}
export interface NegateDecision extends DecisionBase {
  kind: 'negate';
}
export interface CardsDecision extends DecisionBase {
  kind: 'cards';
  min: number;
  max: number;
  /** Selectable card ids (owned by the deciding player). */
  selectable: number[];
  cancelable: boolean;
  targets?: { min: number; max: number; valid: string[] };
  confirmLabel?: string;
}
export interface PickCardDecision extends DecisionBase {
  kind: 'pickCard';
  target: string;
  zones: ('hand' | 'equip' | 'judge')[];
  cancelable: boolean;
}
export interface PlayersDecision extends DecisionBase {
  kind: 'players';
  min: number;
  max: number;
  valid: string[];
  cancelable: boolean;
}
export interface OptionDecision extends DecisionBase {
  kind: 'option';
  options: { id: string; label: string }[];
}
export interface GuanxingDecision extends DecisionBase {
  kind: 'guanxing';
  cards: number[];
}
export interface YijiDecision extends DecisionBase {
  kind: 'yiji';
  cards: number[];
  valid: string[];
}
export interface HarvestDecision extends DecisionBase {
  kind: 'harvest';
  cards: number[];
}

export type Decision =
  | ChooseGeneralDecision
  | PlayDecision
  | RespondDecision
  | NegateDecision
  | CardsDecision
  | PickCardDecision
  | PlayersDecision
  | OptionDecision
  | GuanxingDecision
  | YijiDecision
  | HarvestDecision;

export type DecisionKind = Decision['kind'];

// ───────────────────────── Answers ─────────────────────────

export type Answer =
  | { type: 'general'; general: string }
  | { type: 'useCard'; cardIds: number[]; as: CardName; skill?: string; targets: string[] }
  | { type: 'skill'; skill: string; cardIds: number[]; targets: string[] }
  | { type: 'end' }
  | { type: 'card'; cardIds: number[]; as: CardName; skill?: string }
  | { type: 'respondSkill'; skill: string }
  | { type: 'pass' }
  | { type: 'cards'; cardIds: number[]; targets?: string[] }
  | { type: 'pick'; zone: 'hand' } | { type: 'pick'; cardId: number }
  | { type: 'players'; targets: string[] }
  | { type: 'option'; option: string }
  | { type: 'guanxing'; top: number[]; bottom: number[] }
  | { type: 'yiji'; assign: Record<string, string> }
  | { type: 'harvest'; cardId: number }
  | { type: 'timeout' };

export type Flow<T = void> = Generator<Decision, T, any>;

// ───────────────────────── Legal actions (sent to clients) ─────────────────────────

export interface TargetSpec {
  min: number;
  max: number;
  valid: string[];
  /** Why each non-valid player cannot be chosen (beginner help). */
  reasons: Record<string, string>;
  /** For two-step targeting (Borrowed Sword, Lijian): valid second targets per first target. */
  secondFor?: Record<string, string[]>;
  note?: string;
}

export interface CardSelectSpec {
  min: number;
  max: number;
  from: number[];
}

export interface PlayOption {
  key: string;
  kind: 'card' | 'skill';
  label: string;
  as?: CardName;
  skill?: string;
  /** Fixed card(s) for this option. */
  cardIds?: number[];
  /** Or: the player chooses cards. */
  cardSelect?: CardSelectSpec;
  targets: TargetSpec;
  /** If set, the option is shown but cannot be used, with this explanation. */
  disabled?: string;
}

export interface RespondOptions {
  cards: { cardIds: number[]; as: CardName; skill?: string }[];
  spear: CardSelectSpec | null;
  skills: string[];
}
