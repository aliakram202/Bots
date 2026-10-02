// Public engine API (independent from React and WebSocket code).
import { Game } from './game';
import { playOptions, respondOptions } from './legal';
import { viewFor } from './view';
import type { Answer, GameConfig } from './types';

export const engine = {
  createGame(config: GameConfig): Game {
    return new Game(config);
  },
  getViewFor(game: Game, playerId: string | null) {
    return viewFor(game, playerId);
  },
  getLegalActions(game: Game, playerId: string) {
    const d = game.pending;
    if (!d || !game.waitingOn().includes(playerId)) return null;
    if (d.kind === 'play') return { kind: 'play' as const, options: playOptions(game, playerId) };
    if (d.kind === 'respond') return { kind: 'respond' as const, options: respondOptions(game, playerId, d) };
    return { kind: d.kind };
  },
  dispatch(game: Game, playerId: string, answer: Answer): string | null {
    return game.dispatch(playerId, answer);
  },
  /** Rebuild a game from its config and command history (persistence / replay). */
  replay(config: GameConfig, commands: { player: string; answer: Answer }[], autoUse?: Record<string, boolean>): Game {
    const g = new Game(config);
    for (const c of commands) {
      if (c.player === '__pref__') {
        const a = c.answer as unknown as { pid: string; value: boolean };
        g.autoUse[a.pid] = a.value;
        continue;
      }
      const err = g.dispatch(c.player, c.answer);
      if (err) throw new Error(`replay diverged at command ${JSON.stringify(c)}: ${err}`);
    }
    if (autoUse) Object.assign(g.autoUse, autoUse);
    return g;
  },
};

export { Game };
export type { GameView, PublicPlayer, DecisionView, ViewLogEntry } from './view';
