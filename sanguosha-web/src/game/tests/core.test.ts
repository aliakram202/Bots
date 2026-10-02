import { describe, expect, it } from 'vitest';
import { ALL_CARDS, deckCardIds, getCard } from '../cards/deck';
import { rolesFor, checkVictory } from '../rules/roles';
import { distance, attackRange, seatDistance } from '../rules/distance';
import { engine } from '../engine';
import { viewFor } from '../engine/view';
import type { CardName, PlayerState } from '../engine/types';
import {
  act, cardIn, endPlay, expectDecision, handNames, hp, makeGame, pass, passNegates, respond, runBots, setup, use,
} from './helpers';

describe('deck composition (Standard 104 + 4 EX)', () => {
  const count = (name: CardName, ex?: boolean) => ALL_CARDS.filter((c) => c.name === name && (ex === undefined || !!c.ex === ex)).length;
  it('has 108 cards, 104 standard + 4 EX', () => {
    expect(ALL_CARDS).toHaveLength(108);
    expect(deckCardIds(false)).toHaveLength(104);
    expect(ALL_CARDS.filter((c) => c.ex).map((c) => c.name).sort()).toEqual(['iceSword', 'lightning', 'negate', 'renwangShield']);
  });
  it('has the Standard per-card quantities', () => {
    const expected: Partial<Record<CardName, number>> = {
      slash: 30, dodge: 15, peach: 8, duel: 3, dismantle: 6, steal: 5, exNihilo: 4, barbarians: 3, arrows: 1,
      peachGarden: 1, harvest: 2, borrowedSword: 2, negate: 3, indulgence: 3, lightning: 1, crossbow: 2,
      qinggang: 1, doubleSwords: 1, greenDragon: 1, serpentSpear: 1, axe: 1, halberd: 1, kylinBow: 1,
      eightDiagrams: 2, jueying: 1, dilu: 1, zhuahuang: 1, chitu: 1, dayuan: 1, zixing: 1,
    };
    for (const [name, n] of Object.entries(expected)) expect(count(name as CardName, false), name).toBe(n);
  });
  it('has 26 standard cards per suit, ranks A–K twice each', () => {
    for (const suit of ['spade', 'heart', 'club', 'diamond']) {
      const std = ALL_CARDS.filter((c) => c.suit === suit && !c.ex);
      expect(std).toHaveLength(26);
      for (let r = 1; r <= 13; r++) expect(std.filter((c) => c.rank === r)).toHaveLength(2);
    }
  });
  it('places key cards at their exact suit/rank', () => {
    const at = (name: CardName, suit: string, rank: number) => ALL_CARDS.some((c) => c.name === name && c.suit === suit && c.rank === rank);
    expect(at('lightning', 'spade', 1)).toBe(true);
    expect(at('peachGarden', 'heart', 1)).toBe(true);
    expect(at('arrows', 'heart', 1)).toBe(true);
    expect(at('chitu', 'heart', 5)).toBe(true);
    expect(at('halberd', 'diamond', 12)).toBe(true);
    expect(at('qinggang', 'spade', 6)).toBe(true);
  });
});

describe('role distribution', () => {
  const tally = (roles: string[]) => roles.reduce<Record<string, number>>((a, r) => ((a[r] = (a[r] ?? 0) + 1), a), {});
  it.each([
    [4, { lord: 1, loyalist: 1, rebel: 1, renegade: 1 }],
    [5, { lord: 1, loyalist: 1, rebel: 2, renegade: 1 }],
    [6, { lord: 1, loyalist: 1, rebel: 3, renegade: 1 }],
    [7, { lord: 1, loyalist: 2, rebel: 3, renegade: 1 }],
    [8, { lord: 1, loyalist: 2, rebel: 4, renegade: 1 }],
  ])('%i players', (n, exp) => expect(tally(rolesFor(n))).toEqual(exp));
  it('supports double-Renegade variants for 6 and 8', () => {
    expect(tally(rolesFor(6, 'doubleRenegade'))).toEqual({ lord: 1, loyalist: 1, rebel: 2, renegade: 2 });
    expect(tally(rolesFor(8, 'doubleRenegade'))).toEqual({ lord: 1, loyalist: 2, rebel: 3, renegade: 2 });
  });
  it('Lord has +1 max HP in 5+ player games and is public', () => {
    const g = makeGame(5, 3);
    runUntilPlay(g);
    const lord = g.state.players.find((p) => p.role === 'lord')!;
    const def = lord.maxHp;
    expect(lord.roleRevealed).toBe(true);
    expect(def).toBeGreaterThanOrEqual(4);
    const other = viewFor(g, g.state.players.find((p) => p.role !== 'lord')!.id);
    expect(other.players.find((p) => p.id === lord.id)!.role).toBe('lord');
  });
});

function runUntilPlay(g: ReturnType<typeof makeGame>) {
  while (g.pending && g.pending.kind === 'chooseGeneral') {
    for (const p of g.waitingOn()) act(g, p, { type: 'general', general: (g.pending as any).options[p][0] });
  }
}

describe('victory conditions', () => {
  const mk = (spec: [string, boolean][]): PlayerState[] =>
    spec.map(([role, alive], i) => ({ id: `p${i}`, seat: i, role, alive } as unknown as PlayerState));
  it('Lord + Loyalists win when all Rebels and Renegades are dead', () => {
    expect(checkVictory(mk([['lord', true], ['loyalist', false], ['rebel', false], ['renegade', false]]))?.side).toBe('lord');
  });
  it('Rebels win when the Lord dies (even if all Rebels are dead)', () => {
    expect(checkVictory(mk([['lord', false], ['loyalist', true], ['rebel', false], ['renegade', true]]))?.side).toBe('rebel');
  });
  it('Renegade wins only as the sole survivor when the Lord dies', () => {
    expect(checkVictory(mk([['lord', false], ['loyalist', false], ['rebel', false], ['renegade', true]]))?.side).toBe('renegade');
  });
  it('two Renegades alive when the Lord dies → Rebels win', () => {
    expect(checkVictory(mk([['lord', false], ['rebel', false], ['renegade', true], ['renegade', true]]))?.side).toBe('rebel');
  });
  it('no winner while Lord alive and an enemy remains', () => {
    expect(checkVictory(mk([['lord', true], ['rebel', false], ['renegade', true]]))).toBeNull();
  });
});

describe('determinism', () => {
  it('same seed → same shuffle; different seed → different shuffle', () => {
    expect(makeGame(5, 7).state.drawPile).toEqual(makeGame(5, 7).state.drawPile);
    expect(makeGame(5, 7).state.drawPile).not.toEqual(makeGame(5, 8).state.drawPile);
  });
  it('a match can be replayed exactly from its command log', () => {
    const g = makeGame(6, 11);
    runBots(g, 5);
    const r = engine.replay(g.config, g.commands);
    expect(r.state.winner).toEqual(g.state.winner);
    expect(r.state.players.map((p) => [p.hp, p.alive, p.hand])).toEqual(g.state.players.map((p) => [p.hp, p.alive, p.hand]));
  });
});

describe('distance and attack range', () => {
  it('seat distance is the shorter way around and skips the dead', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao', 'xuchu', 'guojia'] });
    const P = (i: number) => g.player(`p${i}`);
    expect(seatDistance(g, P(1), P(2))).toBe(1);
    expect(seatDistance(g, P(1), P(4))).toBe(3);
    expect(seatDistance(g, P(1), P(6))).toBe(1);
    expect(seatDistance(g, P(1), P(5))).toBe(2);
    P(6).alive = false;
    expect(seatDistance(g, P(1), P(5))).toBe(1);
  });
  it('+1 horse on the target and −1 horse on the source; min 1; Mashu', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'machao', 'zhangliao', 'xuchu'], equips: [['chitu'], ['jueying'], [], [], []] });
    const P = (i: number) => g.player(`p${i}`);
    expect(distance(g, P(2), P(1))).toBe(1); // p1 has no +1 horse
    expect(distance(g, P(1), P(2))).toBe(1); // 1 +1 (jueying) −1 (chitu) = 1
    expect(distance(g, P(3), P(1))).toBe(1); // 2 −1 (mashu)
    expect(distance(g, P(4), P(2))).toBe(3); // 2 +1
  });
  it('attack range comes from the weapon', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], equips: [['halberd'], [], []] });
    expect(attackRange(g.player('p1'))).toBe(4);
    expect(attackRange(g.player('p2'))).toBe(1);
  });
});

describe('turn structure', () => {
  it('draws 2 in the Draw phase, then enters Play', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], hands: [['slash'], [], [], []] });
    expectDecision(g, 'play', 'p1');
    expect(g.player('p1').hand).toHaveLength(3);
  });
  it('enforces the hand limit (= current HP) in the Discard phase', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], hands: [['slash', 'slash', 'slash', 'dodge'], [], [], []], hp: [2] });
    endPlay(g, 'p1');
    expectDecision(g, 'cards', 'p1');
    expect((g.pending as any).min).toBe(4); // 6 cards, HP 2
    act(g, 'p1', { type: 'cards', cardIds: g.player('p1').hand.slice(0, 4) });
    expect(g.player('p1').hand).toHaveLength(2);
    expect(g.state.turn?.player).toBe('p2');
  });
  it('allows only one Slash per Play phase by default', () => {
    const g = setup({ generals: ['caocao', 'zhangliao', 'xuchu', 'ganning'], hands: [['slash', 'slash'], [], [], []] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(3);
    const err = g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'slash')], as: 'slash', targets: ['p2'] });
    expect(err).toMatch(/already been used/);
  });
  it('Zhuge Crossbow and Paoxiao allow unlimited Slashes', () => {
    const g = setup({ generals: ['zhangfei', 'caocao', 'xiahoudun', 'zhangliao'], roles: ['rebel', 'lord', 'loyalist', 'renegade'], hands: [['slash', 'slash', 'slash'], [], [], []], hp: [undefined, 5] });
    for (let i = 0; i < 3; i++) {
      use(g, 'p1', 'slash', ['p2']);
      pass(g, 'p2');
    }
    expect(hp(g, 'p2')).toBe(2);
  });
  it('rejects targets out of attack range with an explanation', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao', 'xuchu'], hands: [['slash'], [], [], [], []] });
    const err = g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'slash')], as: 'slash', targets: ['p3'] });
    expect(err).toMatch(/Out of attack range/);
  });
});

describe('basic cards & responses', () => {
  it('Dodge cancels a Slash; otherwise 1 damage', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], hands: [['slash', 'crossbow', 'slash'], ['dodge'], [], []] });
    use(g, 'p1', 'crossbow');
    use(g, 'p1', 'slash', ['p2']);
    expectDecision(g, 'respond', 'p2');
    respond(g, 'p2', 'dodge');
    expect(hp(g, 'p2')).toBe(3);
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(2);
  });
  it('Peach heals 1 in the Play phase only when injured', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], hands: [['peach', 'peach'], [], [], []], hp: [3] });
    use(g, 'p1', 'peach');
    expect(hp(g, 'p1')).toBe(4);
    expect(g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'peach')], as: 'peach', targets: [] })).toMatch(/full HP/);
  });
});

describe('dying, rescue and death', () => {
  it('another player can save a dying character with Peach', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], roles: ['lord', 'rebel', 'loyalist', 'renegade'], hands: [['slash'], [], ['peach'], []], hp: [undefined, 1] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    // Rescue order starts with the current player (p1 has no Peach → skipped), then p2 (none), then p3.
    expectDecision(g, 'respond', 'p3');
    respond(g, 'p3', 'peach');
    expect(hp(g, 'p2')).toBe(1);
    expect(g.player('p2').alive).toBe(true);
  });
  it('HP below 0 needs several Peaches; unrescued characters die and reveal their role', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], roles: ['lord', 'rebel', 'loyalist', 'renegade'], hands: [['lightning'], ['peach'], [], []], judges: [[], [], [], []], hp: [undefined, 1] });
    // Force a 3-damage hit: give p2 lightning via scenario on next game instead
    endPlay(g, 'p1');
    expect(g.player('p2').alive).toBe(true);
    const g2 = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], roles: ['lord', 'rebel', 'loyalist', 'renegade'], judges: [['lightning'], [], [], []], hands: [['peach', 'peach'], [], [], []], deckTop: [spadeCard(5), 'dilu', 'zhuahuang'], hp: [2] });
    // Lightning strikes p1 at HP 2 → HP -1; needs 2 Peaches.
    passNegates(g2);
    expect(hp(g2, 'p1')).toBe(-1);
    expectDecision(g2, 'respond', 'p1');
    respond(g2, 'p1', 'peach');
    expectDecision(g2, 'respond', 'p1');
    respond(g2, 'p1', 'peach');
    expect(hp(g2, 'p1')).toBe(1);
  });
  it('killing a Rebel rewards the killer with 3 cards', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], roles: ['lord', 'rebel', 'loyalist', 'renegade'], hands: [['slash'], [], [], []], hp: [undefined, 1] });
    const before = g.player('p1').hand.length;
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expect(g.player('p2').alive).toBe(false);
    expect(g.player('p2').roleRevealed).toBe(true);
    expect(g.player('p1').hand.length).toBe(before - 1 + 3);
  });
  it('the Lord killing a Loyalist discards all hand and equipment cards', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], roles: ['lord', 'loyalist', 'rebel', 'renegade'], hands: [['slash', 'dodge', 'peach'], [], [], []], equips: [['qinggang'], [], [], []], hp: [undefined, 1] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expectDecision(g, 'respond', 'p1'); // Lord holds a Peach and may save the Loyalist
    pass(g, 'p1');
    expect(g.player('p2').alive).toBe(false);
    expect(g.player('p1').hand).toHaveLength(0);
    expect(g.player('p1').equip.weapon).toBeUndefined();
  });
  it('Lord death ends the game immediately with a Rebel win', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], roles: ['rebel', 'lord', 'loyalist', 'renegade'], hands: [['slash'], [], [], []], hp: [undefined, 1] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expect(g.state.status).toBe('finished');
    expect(g.state.winner?.side).toBe('rebel');
    expect(g.state.players.every((p) => p.roleRevealed)).toBe(true);
  });
  it('Renegade end-game: Renegade kills the Lord last and wins', () => {
    const g = setup({ generals: ['lubu', 'caocao', 'xiahoudun'], roles: ['renegade', 'lord', 'rebel'], hands: [['slash'], [], []], hp: [undefined, 1] });
    g.player('p3').alive = false; // rebel already dead
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expect(g.state.winner?.side).toBe('renegade');
  });
  it('the current player dying ends their turn immediately', () => {
    const g = setup({ generals: ['huanggai', 'caocao', 'xiahoudun', 'zhangliao'], roles: ['rebel', 'lord', 'loyalist', 'renegade'], hp: [1] });
    act(g, 'p1', { type: 'skill', skill: 'kurou', cardIds: [], targets: [] });
    expect(g.player('p1').alive).toBe(false);
    expect(g.state.turn?.player).toBe('p2');
  });
});

describe('trick cards', () => {
  it('Duel: alternate Slashes, the first who fails takes damage', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], hands: [['duel', 'slash'], ['slash'], [], []] });
    use(g, 'p1', 'duel', ['p2']);
    passNegates(g);
    respond(g, 'p2', 'slash');
    respond(g, 'p1', 'slash');
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(2);
  });
  it('Barbarian Invasion and Hail of Arrows hit everyone else in seat order', () => {
    const g = setup({ generals: ['caocao', 'zhangliao', 'xuchu', 'ganning'], hands: [['barbarians', 'arrows'], ['slash'], [], ['dodge']] });
    use(g, 'p1', 'barbarians');
    respond(g, 'p2', 'slash');
    pass(g, 'p3');
    pass(g, 'p4');
    expect([hp(g, 'p2'), hp(g, 'p3'), hp(g, 'p4')]).toEqual([4, 3, 3]);
    use(g, 'p1', 'arrows');
    pass(g, 'p2');
    pass(g, 'p3');
    respond(g, 'p4', 'dodge');
    expect([hp(g, 'p2'), hp(g, 'p3'), hp(g, 'p4')]).toEqual([3, 2, 3]);
  });
  it('Negate cancels a trick and can itself be negated', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao'], hands: [['exNihilo', 'negate'], ['negate'], [], []] });
    const before = g.player('p1').hand.length;
    use(g, 'p1', 'exNihilo');
    expectDecision(g, 'negate');
    act(g, 'p2', { type: 'card', cardIds: [cardIn(g, 'p2', 'negate')], as: 'negate' });
    expectDecision(g, 'negate', 'p1');
    act(g, 'p1', { type: 'card', cardIds: [cardIn(g, 'p1', 'negate')], as: 'negate' });
    expect(g.pending?.kind).toBe('play');
    expect(g.player('p1').hand.length).toBe(before - 2 + 2);
  });
  it('Dismantle and Steal (distance 1)', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun', 'zhangliao', 'xuchu'], hands: [['dismantle', 'steal', 'steal'], [], ['dodge'], [], []], equips: [[], ['qinggang'], [], [], []] });
    use(g, 'p1', 'dismantle', ['p2']);
    act(g, 'p1', { type: 'pick', cardId: g.player('p2').equip.weapon! });
    expect(g.player('p2').equip.weapon).toBeUndefined();
    expect(g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'steal')], as: 'steal', targets: ['p3'] })).toMatch(/distance 1/);
    const g2 = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['steal'], ['dodge'], []] });
    use(g2, 'p1', 'steal', ['p2']);
    act(g2, 'p1', { type: 'pick', zone: 'hand' });
    expect(handNames(g2, 'p1')).toContain('dodge');
    expect(g2.player('p2').hand).toHaveLength(0);
  });
  it('Peach Garden heals everyone injured; Bountiful Harvest gives one card each', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['peachGarden', 'harvest'], [], []], hp: [3, 2, undefined] });
    use(g, 'p1', 'peachGarden');
    expect([hp(g, 'p1'), hp(g, 'p2'), hp(g, 'p3')]).toEqual([4, 3, 4]);
    const sizes = g.state.players.map((p) => p.hand.length);
    use(g, 'p1', 'harvest');
    for (const pid of ['p1', 'p2', 'p3']) {
      expectDecision(g, 'harvest', pid);
      act(g, pid, { type: 'harvest', cardId: (g.pending as any).cards[0] });
    }
    expect(g.state.players.map((p) => p.hand.length)).toEqual([sizes[0] - 1 + 1, sizes[1] + 1, sizes[2] + 1]);
  });
  it('Borrowed Sword: Slash the chosen target or hand over the weapon', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['borrowedSword'], [], []], equips: [[], ['crossbow'], []] });
    expect(g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'borrowedSword')], as: 'borrowedSword', targets: ['p2'] })).toMatch(/exactly 2/);
    act(g, 'p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'borrowedSword')], as: 'borrowedSword', targets: ['p2', 'p3'] });
    expectDecision(g, 'respond', 'p2');
    pass(g, 'p2');
    expect(handNames(g, 'p1')).toContain('crossbow');
  });
});

function spadeCard(rank: number): number {
  return ALL_CARDS.find((c) => c.suit === 'spade' && c.rank === rank && !c.ex)!.id;
}

describe('delayed tricks and judgment', () => {
  it('Indulgence skips the Play phase unless the judgment is a heart', () => {
    const heart = ALL_CARDS.find((c) => c.suit === 'heart' && c.name === 'peach')!.id;
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], judges: [['indulgence'], [], []], deckTop: [spadeCard(7)] });
    expect(g.state.turn?.player).not.toBe('p1');
    const g2 = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], judges: [['indulgence'], [], []], deckTop: [heart, 'dilu', 'zhuahuang'] });
    expectDecision(g2, 'play', 'p1');
  });
  it('Lightning: ♠2–9 deals 3 damage; otherwise it moves to the next player', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], judges: [['lightning'], [], []], hp: [5], deckTop: [spadeCard(5), 'dilu', 'zhuahuang'] });
    expect(hp(g, 'p1')).toBe(2);
    const g2 = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], judges: [['lightning'], [], []], deckTop: [spadeCard(10), 'dilu', 'zhuahuang'] });
    expect(g2.player('p2').judge.map((j) => j.as)).toEqual(['lightning']);
    expect(g2.player('p1').judge).toHaveLength(0);
  });
  it('Negated Lightning moves on without a judgment', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], judges: [['lightning'], [], []], hands: [[], ['negate'], []] });
    expectDecision(g, 'negate', 'p2');
    act(g, 'p2', { type: 'card', cardIds: [cardIn(g, 'p2', 'negate')], as: 'negate' });
    expect(g.player('p2').judge.map((j) => j.as)).toEqual(['lightning']);
  });
  it('Lightning cannot be placed twice; Indulgence cannot target a character that already has one', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['lightning', 'indulgence'], [], []], judges: [[], ['indulgence'], []], deckTop: ['dilu', 'zhuahuang'] });
    expect(g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'indulgence')], as: 'indulgence', targets: ['p2'] })).toMatch(/already/);
    use(g, 'p1', 'lightning');
    expect(g.player('p1').judge.map((j) => j.as)).toEqual(['lightning']);
  });
});

describe('equipment', () => {
  it('equipping replaces and discards the previous item in that slot', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['halberd'], [], []], equips: [['qinggang'], [], []] });
    const old = g.player('p1').equip.weapon!;
    use(g, 'p1', 'halberd');
    expect(getCard(g.player('p1').equip.weapon!).name).toBe('halberd');
    expect(g.state.discardPile).toContain(old);
  });
  it('Renwang Shield blocks black Slash; Qinggang Sword ignores it', () => {
    const black = ALL_CARDS.find((c) => c.name === 'slash' && c.suit === 'spade')!.id;
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [[black], [], []], equips: [[], ['renwangShield'], []] });
    use(g, 'p1', black, ['p2']);
    expect(hp(g, 'p2')).toBe(3);
    const g2 = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [[black], [], []], equips: [['qinggang'], ['renwangShield'], []] });
    use(g2, 'p1', black, ['p2']);
    pass(g2, 'p2');
    expect(hp(g2, 'p2')).toBe(2);
  });
  it('Eight Trigrams: red judgment counts as a Dodge', () => {
    const red = ALL_CARDS.find((c) => c.name === 'peach' && c.suit === 'heart')!.id;
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['slash'], [], []], equips: [[], ['eightDiagrams'], []], deckTop: ['dilu', 'zhuahuang', red] });
    use(g, 'p1', 'slash', ['p2']);
    act(g, 'p2', { type: 'respondSkill', skill: 'eightDiagrams' });
    expect(hp(g, 'p2')).toBe(3);
  });
  it('Sky Piercing Halberd: last-card Slash may take 3 targets', () => {
    const g = setup({ generals: ['caocao', 'zhangliao', 'xuchu', 'ganning'], hands: [['slash'], [], [], []], equips: [['halberd'], [], [], []] });
    // p1 drew 2 horses in the Draw phase: equip both so the Slash becomes the last hand card.
    use(g, 'p1', 'dilu');
    use(g, 'p1', 'zhuahuang');
    act(g, 'p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'slash')], as: 'slash', targets: ['p2', 'p3', 'p4'] });
    pass(g, 'p2');
    pass(g, 'p3');
    pass(g, 'p4');
    expect([hp(g, 'p2'), hp(g, 'p3'), hp(g, 'p4')]).toEqual([3, 3, 3]);
  });
  it('Rock Cleaving Axe forces a hit by discarding 2 cards', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['slash', 'peach', 'peach'], ['dodge'], []], equips: [['axe'], [], []] });
    use(g, 'p1', 'slash', ['p2']);
    respond(g, 'p2', 'dodge');
    expectDecision(g, 'cards', 'p1');
    act(g, 'p1', { type: 'cards', cardIds: g.player('p1').hand.slice(0, 2) });
    expect(hp(g, 'p2')).toBe(2);
  });
  it('Green Dragon Blade: another Slash after a Dodge', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['slash', 'slash'], ['dodge'], []], equips: [['greenDragon'], [], []] });
    use(g, 'p1', 'slash', ['p2']);
    respond(g, 'p2', 'dodge');
    expectDecision(g, 'respond', 'p1');
    respond(g, 'p1', 'slash');
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(2);
  });
  it('Frost Blade trades damage for discarding 2 cards', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['slash'], ['peach', 'peach'], []], equips: [['iceSword'], [], []], autoUse: false });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    act(g, 'p1', { type: 'option', option: 'yes' });
    act(g, 'p1', { type: 'pick', zone: 'hand' });
    act(g, 'p1', { type: 'pick', zone: 'hand' });
    expect(hp(g, 'p2')).toBe(3);
    expect(g.player('p2').hand).toHaveLength(0);
  });
  it('Kylin Bow shoots down a horse on hit', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['slash'], [], []], equips: [['kylinBow'], ['jueying'], []], autoUse: false });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    act(g, 'p1', { type: 'option', option: 'yes' });
    expect(g.player('p2').equip.horsePlus).toBeUndefined();
    expect(hp(g, 'p2')).toBe(2);
  });
  it('Serpent Spear: two hand cards as a Slash', () => {
    const g = setup({ generals: ['caocao', 'simayi', 'xiahoudun'], hands: [['peach', 'dodge'], [], []], equips: [['serpentSpear'], [], []] });
    const ids = [cardIn(g, 'p1', 'peach'), cardIn(g, 'p1', 'dodge')];
    act(g, 'p1', { type: 'useCard', cardIds: ids, as: 'slash', skill: 'serpentSpear', targets: ['p2'] });
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(2);
  });
  it('Yin-Yang Swords against the opposite gender', () => {
    const g = setup({ generals: ['caocao', 'zhenji', 'xiahoudun'], hands: [['slash'], ['peach'], []], equips: [['doubleSwords'], [], []] });
    use(g, 'p1', 'slash', ['p2']);
    expectDecision(g, 'option', 'p2');
    act(g, 'p2', { type: 'option', option: 'discard' });
    act(g, 'p2', { type: 'cards', cardIds: [cardIn(g, 'p2', 'peach')] });
    expect(g.player('p2').hand).toHaveLength(0);
  });
});

describe('hidden information', () => {
  it('views never contain other players\' hands, roles or private decisions', () => {
    const g = makeGame(6, 21);
    const aId = g.waitingOn()[0];
    runBots(g, 3, 60);
    for (const viewer of g.state.players) {
      const v = viewFor(g, viewer.id);
      for (const p of v.players) {
        if (p.id === viewer.id) continue;
        expect(p.hand).toBeUndefined();
        const real = g.player(p.id);
        if (!real.roleRevealed) expect(p.role).toBeNull();
      }
      const json = JSON.stringify(v);
      expect(json).not.toContain('drawPile');
      if (v.decision && !v.decision.mine) {
        expect(v.decision.playOptions).toBeUndefined();
        expect(v.decision.generals).toBeUndefined();
      }
    }
    expect(aId).toBeTruthy();
  });
});
