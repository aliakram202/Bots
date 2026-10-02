import type { CardName, Color, PhysicalCard, Suit } from '../engine/types';

// Standard Edition (标准版, 2008) deck: 104 game cards + 4 EX cards.
// Each row is exactly one physical card: [name, suit, rank, ex?].
// Sources: BWIKI 标准包卡牌 (via wmzy/sanguosha deck.ts), guozhan.sanguosha.com 卡牌一览.
// Cross-checked: per-suit 26 standard cards; totals Slash 30, Dodge 15, Peach 8.
type Row = [CardName, Suit, number, boolean?];

const S: Suit = 'spade';
const H: Suit = 'heart';
const C: Suit = 'club';
const D: Suit = 'diamond';

const ROWS: Row[] = [
  // ♠ Spade
  ['duel', S, 1], ['lightning', S, 1],
  ['doubleSwords', S, 2], ['eightDiagrams', S, 2], ['iceSword', S, 2, true],
  ['steal', S, 3], ['dismantle', S, 3],
  ['steal', S, 4], ['dismantle', S, 4],
  ['greenDragon', S, 5], ['jueying', S, 5],
  ['indulgence', S, 6], ['qinggang', S, 6],
  ['slash', S, 7], ['barbarians', S, 7],
  ['slash', S, 8], ['slash', S, 8],
  ['slash', S, 9], ['slash', S, 9],
  ['slash', S, 10], ['slash', S, 10],
  ['steal', S, 11], ['negate', S, 11],
  ['serpentSpear', S, 12], ['dismantle', S, 12],
  ['barbarians', S, 13], ['dayuan', S, 13],
  // ♥ Heart
  ['peachGarden', H, 1], ['arrows', H, 1],
  ['dodge', H, 2], ['dodge', H, 2],
  ['peach', H, 3], ['harvest', H, 3],
  ['peach', H, 4], ['harvest', H, 4],
  ['kylinBow', H, 5], ['chitu', H, 5],
  ['peach', H, 6], ['indulgence', H, 6],
  ['peach', H, 7], ['exNihilo', H, 7],
  ['peach', H, 8], ['exNihilo', H, 8],
  ['peach', H, 9], ['exNihilo', H, 9],
  ['slash', H, 10], ['slash', H, 10],
  ['slash', H, 11], ['exNihilo', H, 11],
  ['peach', H, 12], ['dismantle', H, 12], ['lightning', H, 12, true],
  ['dodge', H, 13], ['zhuahuang', H, 13],
  // ♣ Club
  ['duel', C, 1], ['crossbow', C, 1],
  ['slash', C, 2], ['eightDiagrams', C, 2], ['renwangShield', C, 2, true],
  ['slash', C, 3], ['dismantle', C, 3],
  ['slash', C, 4], ['dismantle', C, 4],
  ['slash', C, 5], ['dilu', C, 5],
  ['slash', C, 6], ['indulgence', C, 6],
  ['slash', C, 7], ['barbarians', C, 7],
  ['slash', C, 8], ['slash', C, 8],
  ['slash', C, 9], ['slash', C, 9],
  ['slash', C, 10], ['slash', C, 10],
  ['slash', C, 11], ['slash', C, 11],
  ['borrowedSword', C, 12], ['negate', C, 12],
  ['borrowedSword', C, 13], ['negate', C, 13],
  // ♦ Diamond
  ['duel', D, 1], ['crossbow', D, 1],
  ['dodge', D, 2], ['dodge', D, 2],
  ['dodge', D, 3], ['steal', D, 3],
  ['dodge', D, 4], ['steal', D, 4],
  ['dodge', D, 5], ['axe', D, 5],
  ['slash', D, 6], ['dodge', D, 6],
  ['slash', D, 7], ['dodge', D, 7],
  ['slash', D, 8], ['dodge', D, 8],
  ['slash', D, 9], ['dodge', D, 9],
  ['slash', D, 10], ['dodge', D, 10],
  ['dodge', D, 11], ['dodge', D, 11],
  ['peach', D, 12], ['halberd', D, 12], ['negate', D, 12, true],
  ['slash', D, 13], ['zixing', D, 13],
];

/** All 108 physical cards with stable ids 1..108 (ids are fixed by table position). */
export const ALL_CARDS: PhysicalCard[] = ROWS.map(([name, suit, rank, ex], i) => ({
  id: i + 1,
  name,
  suit,
  rank,
  ...(ex ? { ex: true } : {}),
}));

const BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]));

export function getCard(id: number): PhysicalCard {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown card id ${id}`);
  return c;
}

export function deckCardIds(includeEx: boolean): number[] {
  return ALL_CARDS.filter((c) => includeEx || !c.ex).map((c) => c.id);
}

export function suitColor(suit: Suit | null): Color {
  if (!suit) return 'none';
  return suit === 'heart' || suit === 'diamond' ? 'red' : 'black';
}

export const SUIT_SYMBOL: Record<Suit, string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };
export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function cardLabel(c: PhysicalCard): string {
  return `${SUIT_SYMBOL[c.suit]}${RANK_LABEL[c.rank]}`;
}
