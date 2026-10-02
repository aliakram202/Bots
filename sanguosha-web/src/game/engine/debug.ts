// Developer-only state edits for debug rooms. Applied between decisions and recorded as
// commands (player '__debug__') so that replays reproduce them.

import { getCard } from '../cards/deck';
import { equipSlotOf } from '../cards/definitions';
import { checkVictory } from '../rules/roles';
import type { Game } from './game';
import type { CardName } from './types';

export type DebugAction =
  | { action: 'setHp'; player: string; hp: number }
  | { action: 'give'; player: string; card: CardName }
  | { action: 'equip'; player: string; card: CardName }
  | { action: 'judge'; player: string; card: 'indulgence' | 'lightning' }
  | { action: 'deckTop'; card: CardName }
  | { action: 'peek' }
  | { action: 'kill'; player: string }
  | { action: 'revive'; player: string };

function takeByName(G: Game, name: CardName): number {
  const s = G.state;
  const fromDraw = s.drawPile.find((id) => getCard(id).name === name);
  if (fromDraw !== undefined) return fromDraw;
  const fromDiscard = s.discardPile.find((id) => getCard(id).name === name);
  if (fromDiscard !== undefined) return fromDiscard;
  throw new Error(`No free ${name} in the deck or discard pile.`);
}

export function applyDebug(G: Game, a: DebugAction): string {
  const s = G.state;
  if (s.status === 'finished') throw new Error('Game is over.');
  switch (a.action) {
    case 'setHp': {
      const p = G.player(a.player);
      p.hp = Math.max(1, Math.min(p.maxHp, Math.floor(a.hp)));
      return `[debug] ${G.n(p.id)} HP set to ${p.hp}.`;
    }
    case 'give': {
      const id = takeByName(G, a.card);
      G.moveCards([id], { zone: 'hand', player: a.player });
      return `[debug] gave ${G.c(id)} to ${G.n(a.player)}.`;
    }
    case 'equip': {
      const id = takeByName(G, a.card);
      const slot = equipSlotOf(getCard(id).name);
      if (!slot) throw new Error('Not an equipment card.');
      const p = G.player(a.player);
      const old = p.equip[slot];
      if (old) G.moveCards([old], { zone: 'discard' });
      G.moveCards([id], { zone: 'equip', player: a.player });
      return `[debug] equipped ${G.c(id)} on ${G.n(a.player)}.`;
    }
    case 'judge': {
      const p = G.player(a.player);
      if (p.judge.some((j) => j.as === a.card)) throw new Error('Already has that delayed trick.');
      const id = takeByName(G, a.card);
      G.moveCards([id], { zone: 'judge', player: a.player, as: a.card });
      return `[debug] placed ${G.c(id)} in ${G.n(a.player)}'s judgment area.`;
    }
    case 'deckTop': {
      const id = takeByName(G, a.card);
      G.moveCards([id], { zone: 'drawTop' });
      return `[debug] put ${G.c(id)} on top of the deck.`;
    }
    case 'peek': {
      const top = s.drawPile.slice(0, 5).map((id) => G.c(id));
      return `[debug] top of deck: ${top.join(', ') || '(empty)'}.`;
    }
    case 'kill': {
      const p = G.player(a.player);
      if (!p.alive) throw new Error('Already dead.');
      if (s.turn?.player === p.id) throw new Error('Cannot debug-kill the current player; end their turn first.');
      if (G.pending?.players.includes(p.id)) throw new Error('That player is part of the pending decision.');
      p.alive = false;
      p.roleRevealed = true;
      G.moveCards(G.allCardsOf(p, ['hand', 'equip', 'judge']), { zone: 'discard' });
      const win = checkVictory(s.players);
      if (win) {
        p.alive = true;
        p.roleRevealed = false;
        throw new Error('Killing that player would end the game; use real damage instead.');
      }
      return `[debug] ${G.n(p.id)} was removed from play (${p.role}).`;
    }
    case 'revive': {
      const p = G.player(a.player);
      if (p.alive) throw new Error('Not dead.');
      p.alive = true;
      p.hp = 1;
      return `[debug] ${G.n(p.id)} was revived with 1 HP.`;
    }
  }
}
