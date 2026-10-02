import { describe, expect, it } from 'vitest';
import { makeGame, runBots } from './helpers';

describe('full-match fuzzing with legal-only bots', () => {
  for (const n of [5, 6, 7, 8]) {
    it(`completes ${n}-player games without errors or broken invariants`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const g = makeGame(n, seed * 31 + n);
        runBots(g, seed);
        expect(g.state.status).toBe('finished');
        expect(g.state.winner).not.toBeNull();
        expect(g.checkInvariants()).toBeNull();
      }
    });
  }
});
