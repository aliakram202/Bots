import { getCard } from '../cards/deck';
import { CARD_DEFS } from '../cards/definitions';
import type { Game } from '../engine/game';
import type { CardName, PlayerState } from '../engine/types';

// Distance model (Standard rules):
// - Seat distance: number of steps to the target around the table counting only living players,
//   taking the shorter direction.
// - Target's +1 horse adds 1; source's −1 horse subtracts 1; Mashu subtracts 1. Minimum 1.
// - Attack range: 1 by default, the weapon's range when a weapon is equipped.
// `exclude` lists cards that are leaving play as part of the action being evaluated
// (e.g. Guan Yu using his own equipped red weapon as a Slash), so their effects do not apply.

export function seatDistance(g: Game, from: PlayerState, to: PlayerState): number {
  if (from.id === to.id) return 0;
  const alive = g.state.players.filter((p) => p.alive || p.id === from.id || p.id === to.id);
  const i = alive.findIndex((p) => p.id === from.id);
  const j = alive.findIndex((p) => p.id === to.id);
  const n = alive.length;
  const cw = (j - i + n) % n;
  return Math.min(cw, n - cw);
}

export function distance(g: Game, from: PlayerState, to: PlayerState, exclude: number[] = []): number {
  if (from.id === to.id) return 0;
  let d = seatDistance(g, from, to);
  const plus = to.equip.horsePlus;
  if (plus && !exclude.includes(plus)) d += 1;
  const minus = from.equip.horseMinus;
  if (minus && !exclude.includes(minus)) d -= 1;
  if (g.hasSkill(from, 'mashu')) d -= 1;
  return Math.max(1, d);
}

export function weaponOf(p: PlayerState, exclude: number[] = []): CardName | null {
  const w = p.equip.weapon;
  if (!w || exclude.includes(w)) return null;
  return getCard(w).name;
}

export function armorOf(p: PlayerState, exclude: number[] = []): CardName | null {
  const a = p.equip.armor;
  if (!a || exclude.includes(a)) return null;
  return getCard(a).name;
}

export function attackRange(p: PlayerState, exclude: number[] = []): number {
  const w = weaponOf(p, exclude);
  return w ? CARD_DEFS[w].range ?? 1 : 1;
}

export function inAttackRange(g: Game, from: PlayerState, to: PlayerState, exclude: number[] = []): boolean {
  if (from.id === to.id || !to.alive) return false;
  return distance(g, from, to, exclude) <= attackRange(from, exclude);
}

/** Maximum Slashes per Play phase. */
export function slashLimit(g: Game, p: PlayerState, exclude: number[] = []): number {
  if (g.hasSkill(p, 'paoxiao')) return Infinity;
  if (weaponOf(p, exclude) === 'crossbow') return Infinity;
  return 1;
}

/** Why `target` cannot be chosen for `card` (null = allowed). Covers compulsory protection skills. */
export function protectionReason(g: Game, target: PlayerState, card: CardName): string | null {
  if ((card === 'slash' || card === 'duel') && g.hasSkill(target, 'kongcheng') && target.hand.length === 0) {
    return 'Target is protected by Kongcheng (no hand cards).';
  }
  if ((card === 'steal' || card === 'indulgence') && g.hasSkill(target, 'qianxun')) {
    return 'Target is protected by Qianxun.';
  }
  return null;
}

/** Reason a Slash from `from` cannot target `to` (null = legal). */
export function slashTargetReason(g: Game, from: PlayerState, to: PlayerState, exclude: number[] = []): string | null {
  if (to.id === from.id) return 'You cannot Slash yourself.';
  if (!to.alive) return 'Target is dead.';
  const prot = protectionReason(g, to, 'slash');
  if (prot) return prot;
  if (!inAttackRange(g, from, to, exclude)) {
    return `Out of attack range (distance ${distance(g, from, to, exclude)}, range ${attackRange(from, exclude)}).`;
  }
  return null;
}
