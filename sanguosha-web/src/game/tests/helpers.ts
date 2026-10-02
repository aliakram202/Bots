import { Game } from '../engine/game';
import { botAnswer } from '../engine/bot';
import { Rng } from '../engine/rng';
import type { Answer, GameConfig, Scenario } from '../engine/types';

export function makeGame(n: number, seed = 1, extra: Partial<GameConfig> = {}): Game {
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  return new Game({
    playerIds: ids,
    playerNames: Object.fromEntries(ids.map((id, i) => [id, `Player ${i + 1}`])),
    seed: [seed, seed * 7 + 1, seed * 13 + 5, 99],
    ...extra,
  });
}

export function scenarioGame(n: number, scenario: Scenario, seed = 1): Game {
  return makeGame(n, seed, { scenario });
}

/** Dispatch and throw on an illegal answer. */
export function act(g: Game, player: string, answer: Answer): void {
  const err = g.dispatch(player, answer);
  if (err) throw new Error(`illegal answer from ${player}: ${err} (pending ${g.pending?.kind}: ${g.pending?.prompt})`);
}

/** Let bots play until the game ends or `maxSteps` answers. */
export function runBots(g: Game, seed = 42, maxSteps = 20000): number {
  const rng = new Rng([seed, 2, 3, 4]);
  let steps = 0;
  while (g.pending && steps < maxSteps) {
    const pid = g.waitingOn()[0];
    const ans = botAnswer(g, pid, rng);
    const err = g.dispatch(pid, ans);
    if (err) throw new Error(`bot produced illegal answer (${g.pending?.kind}): ${err} ${JSON.stringify(ans)}`);
    const inv = g.checkInvariants();
    if (inv) throw new Error(`invariant violated after step ${steps}: ${inv}`);
    steps++;
  }
  return steps;
}

export const pending = (g: Game) => g.pending!;

import { getCard } from '../cards/deck';
import type { CardName, Role } from '../engine/types';

export interface Setup {
  generals: string[];
  roles?: Role[];
  hands?: (CardName | number)[][];
  equips?: (CardName | number)[][];
  judges?: ('indulgence' | 'lightning' | number)[][];
  hp?: (number | undefined)[];
  deckTop?: (CardName | number)[];
  start?: number;
  autoUse?: boolean;
  seed?: number;
}

/** Build a scripted game. Players are p1..pN; p1 starts unless `start` is given. */
export function setup(s: Setup): Game {
  const n = s.generals.length;
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  const defaultRoles: Role[] = (['lord', 'rebel', 'loyalist', 'renegade', 'rebel', 'rebel', 'loyalist', 'rebel'] as Role[]).slice(0, n);
  const roles = s.roles ?? defaultRoles;
  const scenario: Scenario = {
    roles: Object.fromEntries(ids.map((id, i) => [id, roles[i]])),
    generals: Object.fromEntries(ids.map((id, i) => [id, s.generals[i]])),
    hands: Object.fromEntries(ids.map((id, i) => [id, s.hands?.[i] ?? []])),
    equips: Object.fromEntries(ids.map((id, i) => [id, s.equips?.[i] ?? []])),
    judges: Object.fromEntries(ids.map((id, i) => [id, s.judges?.[i] ?? []])),
    hp: Object.fromEntries(ids.map((id, i) => [id, s.hp?.[i]]).filter(([, v]) => v !== undefined)),
    deckTop: s.deckTop ?? ['dilu', 'zhuahuang'],
    startPlayer: ids[s.start ?? 0],
  };
  return makeGame(n, s.seed ?? 1, { scenario, autoUseDefault: s.autoUse ?? true });
}

export function cardIn(g: Game, pid: string, name: CardName): number {
  const id = g.player(pid).hand.find((i) => getCard(i).name === name);
  if (id === undefined) throw new Error(`${pid} has no ${name} in hand`);
  return id;
}

export function use(g: Game, pid: string, card: CardName | number, targets: string[] = [], as?: CardName, skill?: string) {
  const id = typeof card === 'number' ? card : cardIn(g, pid, card);
  act(g, pid, { type: 'useCard', cardIds: [id], as: as ?? getCard(id).name, skill, targets });
}

export function respond(g: Game, pid: string, card: CardName | number, as?: CardName, skill?: string) {
  const id = typeof card === 'number' ? card : cardIn(g, pid, card);
  act(g, pid, { type: 'card', cardIds: [id], as: as ?? getCard(id).name, skill });
}

export const pass = (g: Game, pid: string) => act(g, pid, { type: 'pass' });
export const endPlay = (g: Game, pid: string) => act(g, pid, { type: 'end' });
export const yes = (g: Game, pid: string) => act(g, pid, { type: 'option', option: 'yes' });
export const no = (g: Game, pid: string) => act(g, pid, { type: 'option', option: 'no' });

export function expectDecision(g: Game, kind: string, pid?: string) {
  const d = g.pending;
  if (!d) throw new Error(`expected ${kind} decision but game has none (status ${g.state.status})`);
  if (d.kind !== kind || (pid && !g.waitingOn().includes(pid))) {
    throw new Error(`expected ${kind} for ${pid}, got ${d.kind} for ${g.waitingOn().join(',')}: ${d.prompt}`);
  }
}

/** Pass every pending negate window. */
export function passNegates(g: Game) {
  while (g.pending?.kind === 'negate') for (const p of g.waitingOn()) act(g, p, { type: 'pass' });
}

export const hp = (g: Game, pid: string) => g.player(pid).hp;
export const handNames = (g: Game, pid: string) => g.player(pid).hand.map((i) => getCard(i).name);
