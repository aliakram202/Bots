import type { PlayerState, Role, WinnerInfo } from '../engine/types';

// Role distribution (Identity mode). Sources: zh.wikipedia 三国杀 role table, wmzy research 基础规则.md,
// 9game double-renegade article. 'doubleRenegade' is the common alternative for 6 and 8 players.
export const ROLE_TABLE: Record<number, { standard: Role[]; doubleRenegade?: Role[] }> = {
  2: { standard: ['lord', 'rebel'] },
  3: { standard: ['lord', 'rebel', 'renegade'] },
  4: { standard: ['lord', 'loyalist', 'rebel', 'renegade'] },
  5: { standard: ['lord', 'loyalist', 'rebel', 'rebel', 'renegade'] },
  6: {
    standard: ['lord', 'loyalist', 'rebel', 'rebel', 'rebel', 'renegade'],
    doubleRenegade: ['lord', 'loyalist', 'rebel', 'rebel', 'renegade', 'renegade'],
  },
  7: { standard: ['lord', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'renegade'] },
  8: {
    standard: ['lord', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'renegade'],
    doubleRenegade: ['lord', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'renegade', 'renegade'],
  },
};

export function rolesFor(count: number, variant: 'standard' | 'doubleRenegade' = 'standard'): Role[] {
  const row = ROLE_TABLE[count];
  if (!row) throw new Error(`Unsupported player count ${count}`);
  return [...(variant === 'doubleRenegade' && row.doubleRenegade ? row.doubleRenegade : row.standard)];
}

export const ROLE_INFO: Record<Role, { en: string; zh: string; goal: string }> = {
  lord: { en: 'Lord', zh: '主公', goal: 'Eliminate all Rebels and Renegades.' },
  loyalist: { en: 'Loyalist', zh: '忠臣', goal: 'Protect the Lord; win with the Lord.' },
  rebel: { en: 'Rebel', zh: '反贼', goal: 'Kill the Lord.' },
  renegade: { en: 'Renegade', zh: '内奸', goal: 'Be the last one standing: eliminate everyone else, killing the Lord last.' },
};

/**
 * Victory check, evaluated immediately after every death.
 * - Lord dead: if exactly one character survives and it is a Renegade → Renegade wins; otherwise Rebels win
 *   (even if every Rebel is already dead).
 * - Lord alive and no Rebel/Renegade alive → Lord & Loyalists win.
 */
export function checkVictory(players: PlayerState[]): WinnerInfo | null {
  const lord = players.find((p) => p.role === 'lord');
  if (!lord) return null;
  const alive = players.filter((p) => p.alive);
  if (!lord.alive) {
    if (alive.length === 1 && alive[0].role === 'renegade') {
      return {
        side: 'renegade',
        winners: [alive[0].id],
        reason: 'The Lord fell with only the Renegade left standing — the Renegade seizes the throne.',
      };
    }
    return {
      side: 'rebel',
      winners: players.filter((p) => p.role === 'rebel').map((p) => p.id),
      reason: 'The Lord has been killed — the Rebels win.',
    };
  }
  if (!alive.some((p) => p.role === 'rebel' || p.role === 'renegade')) {
    return {
      side: 'lord',
      winners: players.filter((p) => p.role === 'lord' || p.role === 'loyalist').map((p) => p.id),
      reason: 'All Rebels and Renegades have been eliminated — the Lord and Loyalists win.',
    };
  }
  return null;
}
