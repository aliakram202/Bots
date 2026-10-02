import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard } from '../cards/deck';
import { distance } from '../rules/distance';
import type { CardName, Suit } from '../engine/types';
import { act, cardIn, endPlay, expectDecision, handNames, hp, no, pass, passNegates, respond, setup, use, yes } from './helpers';

const find = (name: CardName, suit?: Suit, rank?: number) =>
  ALL_CARDS.find((c) => c.name === name && (!suit || c.suit === suit) && (!rank || c.rank === rank) && !c.ex)!.id;
const spade7slash = find('slash', 'spade', 7);
const heartPeach = find('peach', 'heart', 3);
const club2slash = find('slash', 'club', 2);
const diamondDodge = find('dodge', 'diamond', 2);
const heartDodge = find('dodge', 'heart', 2);

describe('Wei skills', () => {
  it('Jianxiong: Cao Cao obtains the Slash that damaged him', () => {
    const g = setup({ generals: ['guanyu', 'caocao', 'zhangliao'], roles: ['rebel', 'lord', 'loyalist'], hands: [[spade7slash], [], []] });
    use(g, 'p1', spade7slash, ['p2']);
    pass(g, 'p2');
    expect(g.player('p2').hand).toContain(spade7slash);
  });
  it('Hujia: another Wei character plays a Dodge for the Lord', () => {
    const g = setup({ generals: ['guanyu', 'caocao', 'simayi'], roles: ['rebel', 'lord', 'loyalist'], hands: [['slash'], [], ['dodge']] });
    use(g, 'p1', 'slash', ['p2']);
    act(g, 'p2', { type: 'respondSkill', skill: 'hujia' });
    expectDecision(g, 'respond', 'p3');
    respond(g, 'p3', 'dodge');
    expect(hp(g, 'p2')).toBe(4); // 3 players: no Lord HP bonus
    expect(g.player('p3').hand).toHaveLength(0);
  });
  it('Hujia is not available when Cao Cao is not the Lord', () => {
    const g = setup({ generals: ['guanyu', 'caocao', 'simayi'], roles: ['lord', 'rebel', 'loyalist'], hands: [['slash'], [], ['dodge']] });
    use(g, 'p1', 'slash', ['p2']);
    expect(g.dispatch('p2', { type: 'respondSkill', skill: 'hujia' })).toMatch(/not available/);
  });
  it('Fankui: Sima Yi takes a card from the damage source', () => {
    const g = setup({ generals: ['guanyu', 'simayi', 'zhangliao'], hands: [['slash'], [], []], equips: [['qinggang'], [], []], autoUse: false });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    yes(g, 'p2');
    act(g, 'p2', { type: 'pick', cardId: g.player('p1').equip.weapon! });
    expect(handNames(g, 'p2')).toContain('qinggang');
  });
  it('Guicai: Sima Yi replaces a judgment card with a hand card', () => {
    const g = setup({ generals: ['guanyu', 'simayi', 'zhangliao'], judges: [['indulgence'], [], []], hands: [[], [heartPeach], []], deckTop: [spade7slash, 'dilu', 'zhuahuang'] });
    passNegates(g);
    expectDecision(g, 'cards', 'p2');
    act(g, 'p2', { type: 'cards', cardIds: [heartPeach] });
    expectDecision(g, 'play', 'p1'); // heart → Indulgence fails, Guan Yu plays
  });
  it('Ganglie: non-heart judgment → source discards 2 or takes 1 damage', () => {
    const g = setup({ generals: ['guanyu', 'xiahoudun', 'zhangliao'], hands: [['slash'], [], []], deckTop: ['dilu', 'zhuahuang', spade7slash], autoUse: false });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    yes(g, 'p2');
    // p1 holds 2 horse cards → may choose
    expectDecision(g, 'option', 'p1');
    act(g, 'p1', { type: 'option', option: 'damage' });
    expect(hp(g, 'p1')).toBe(3);
  });
  it('Tuxi: take one hand card from up to two players instead of drawing', () => {
    const g = setup({ generals: ['zhangliao', 'guanyu', 'zhangfei'], hands: [[], ['dodge'], ['peach']] });
    expectDecision(g, 'players', 'p1');
    act(g, 'p1', { type: 'players', targets: ['p2', 'p3'] });
    expect(handNames(g, 'p1').sort()).toEqual(['dodge', 'peach']);
  });
  it('Luoyi: draw 1 fewer; Slash deals +1 damage this turn', () => {
    const g = setup({ generals: ['xuchu', 'guanyu', 'zhangfei'], hands: [['slash'], [], []], autoUse: false });
    yes(g, 'p1');
    expect(g.player('p1').hand).toHaveLength(2);
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(2);
  });
  it('Tiandu: Guo Jia obtains his own judgment card', () => {
    const g = setup({ generals: ['guojia', 'guanyu', 'zhangfei'], judges: [['indulgence'], [], []], deckTop: [spade7slash, 'dilu', 'zhuahuang'] });
    passNegates(g);
    expect(g.player('p1').hand).toContain(spade7slash);
  });
  it('Yiji: per point of damage, look at the top 2 cards and hand them out', () => {
    const g = setup({ generals: ['guanyu', 'guojia', 'zhangfei'], hands: [['slash'], [], []] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expectDecision(g, 'yiji', 'p2');
    const cards = (g.pending as any).cards as number[];
    act(g, 'p2', { type: 'yiji', assign: { [cards[0]]: 'p2', [cards[1]]: 'p3' } });
    expect(g.player('p2').hand).toContain(cards[0]);
    expect(g.player('p3').hand).toContain(cards[1]);
  });
  it('Qingguo: Zhen Ji uses a black hand card as Dodge', () => {
    const g = setup({ generals: ['guanyu', 'zhenji', 'zhangfei'], hands: [['slash'], [club2slash], []] });
    use(g, 'p1', 'slash', ['p2']);
    act(g, 'p2', { type: 'card', cardIds: [club2slash], as: 'dodge', skill: 'qingguo' });
    expect(hp(g, 'p2')).toBe(3);
  });
  it('Luoshen: keep black judgments until a red one appears', () => {
    const blacks = [find('slash', 'spade', 8), find('slash', 'club', 3)];
    const g = setup({ generals: ['zhenji', 'guanyu', 'zhangfei'], deckTop: [...blacks, heartPeach, 'dilu', 'zhuahuang'] });
    expectDecision(g, 'play', 'p1');
    expect(g.player('p1').hand).toEqual(expect.arrayContaining(blacks));
    expect(g.state.discardPile).toContain(heartPeach);
  });
});

describe('Shu skills', () => {
  it('Rende: give 2+ cards in a phase to recover 1 HP once', () => {
    const g = setup({ generals: ['liubei', 'guanyu', 'zhangfei'], hp: [3] });
    const [a, b] = g.player('p1').hand;
    act(g, 'p1', { type: 'skill', skill: 'rende', cardIds: [a], targets: ['p2'] });
    expect(hp(g, 'p1')).toBe(3);
    act(g, 'p1', { type: 'skill', skill: 'rende', cardIds: [b], targets: ['p3'] });
    expect(hp(g, 'p1')).toBe(4);
  });
  it('Jijiang: a Shu character supplies the Lord\'s Slash', () => {
    const g = setup({ generals: ['liubei', 'guanyu', 'caocao'], roles: ['lord', 'loyalist', 'rebel'], hands: [[], ['slash'], []] });
    act(g, 'p1', { type: 'skill', skill: 'jijiang', cardIds: [], targets: ['p3'] });
    expectDecision(g, 'respond', 'p2');
    respond(g, 'p2', 'slash');
    expectDecision(g, 'respond', 'p3');
    pass(g, 'p3');
    expect(hp(g, 'p3')).toBe(3);
    expect(g.state.turn?.slashUsed).toBe(1);
  });
  it('Wusheng: any red card as Slash, including equipment', () => {
    const g = setup({ generals: ['guanyu', 'zhangliao', 'zhangfei'], hands: [[heartPeach], [], []], equips: [['chitu'], [], []] });
    act(g, 'p1', { type: 'useCard', cardIds: [heartPeach], as: 'slash', skill: 'wusheng', targets: ['p2'] });
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(3);
  });
  it('Guanxing: rearrange the top cards at the start phase', () => {
    const g = setup({ generals: ['zhugeliang', 'guanyu', 'zhangfei'], deckTop: [heartPeach, spade7slash, 'dilu'] });
    expectDecision(g, 'guanxing', 'p1');
    const cards = (g.pending as any).cards as number[];
    expect(cards.slice(0, 3)).toEqual([heartPeach, spade7slash, find('dilu')]);
    act(g, 'p1', { type: 'guanxing', top: [spade7slash, find('dilu')], bottom: cards.filter((c) => c !== spade7slash && c !== find('dilu')) });
    expect(g.player('p1').hand).toEqual(expect.arrayContaining([spade7slash, find('dilu')]));
    expect(g.state.drawPile[g.state.drawPile.length - 1]).not.toBe(spade7slash);
  });
  it('Kongcheng: no hand cards → cannot be targeted by Slash or Duel', () => {
    const g = setup({ generals: ['guanyu', 'zhugeliang', 'zhangfei'], hands: [['slash', 'duel'], [], []] });
    expect(g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'slash')], as: 'slash', targets: ['p2'] })).toMatch(/Kongcheng/);
    expect(g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'duel')], as: 'duel', targets: ['p2'] })).toMatch(/Kongcheng/);
  });
  it('Longdan: Dodge as Slash and Slash as Dodge', () => {
    const g = setup({ generals: ['zhaoyun', 'guanyu', 'zhangfei'], hands: [[diamondDodge], ['slash'], []] });
    act(g, 'p1', { type: 'useCard', cardIds: [diamondDodge], as: 'slash', skill: 'longdan', targets: ['p2'] });
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(3);
    const g2 = setup({ generals: ['guanyu', 'zhaoyun', 'zhangfei'], hands: [['slash'], [club2slash], []] });
    use(g2, 'p1', 'slash', ['p2']);
    act(g2, 'p2', { type: 'card', cardIds: [club2slash], as: 'dodge', skill: 'longdan' });
    expect(hp(g2, 'p2')).toBe(4);
  });
  it('Mashu: distance −1', () => {
    const g = setup({ generals: ['machao', 'guanyu', 'zhangfei', 'zhangliao', 'xuchu'] });
    expect(distance(g, g.player('p1'), g.player('p3'))).toBe(1);
    expect(distance(g, g.player('p3'), g.player('p1'))).toBe(2);
  });
  it('Tieji: red judgment → target cannot Dodge', () => {
    const g = setup({ generals: ['machao', 'zhangliao', 'zhangfei'], hands: [['slash'], ['dodge'], []], deckTop: ['dilu', 'zhuahuang', heartPeach] });
    use(g, 'p1', 'slash', ['p2']);
    expect(hp(g, 'p2')).toBe(3);
    expect(handNames(g, 'p2')).toEqual(['dodge']);
  });
  it('Jizhi: draw 1 when using an instant trick', () => {
    const g = setup({ generals: ['huangyueying', 'guanyu', 'zhangfei'], hands: [['exNihilo'], [], []] });
    const before = g.player('p1').hand.length;
    use(g, 'p1', 'exNihilo');
    passNegates(g);
    expect(g.player('p1').hand.length).toBe(before - 1 + 1 + 2);
  });
  it('Qicai: Steal ignores distance', () => {
    const g = setup({ generals: ['huangyueying', 'guanyu', 'zhangfei', 'zhangliao', 'xuchu'], hands: [['steal'], [], ['dodge'], [], []] });
    use(g, 'p1', 'steal', ['p3']);
    passNegates(g);
    act(g, 'p1', { type: 'pick', zone: 'hand' });
    expect(handNames(g, 'p1')).toContain('dodge');
  });
});

describe('Wu skills', () => {
  it('Zhiheng: discard any cards, draw that many, once per phase', () => {
    const g = setup({ generals: ['sunquan', 'guanyu', 'zhangfei'] });
    const ids = g.player('p1').hand.slice(0, 2);
    act(g, 'p1', { type: 'skill', skill: 'zhiheng', cardIds: ids, targets: [] });
    expect(g.player('p1').hand).toHaveLength(2);
    expect(g.player('p1').hand).not.toContain(ids[0]);
    expect(g.dispatch('p1', { type: 'skill', skill: 'zhiheng', cardIds: [g.player('p1').hand[0]], targets: [] })).toMatch(/once per Play phase/);
  });
  it('Jiuyuan: a Wu character\'s Peach heals the dying Lord Sun Quan for 2', () => {
    const g = setup({ generals: ['guanyu', 'sunquan', 'ganning'], roles: ['rebel', 'lord', 'loyalist'], hands: [['slash'], [], ['peach']], hp: [undefined, 1] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expectDecision(g, 'respond', 'p3');
    respond(g, 'p3', 'peach');
    expect(hp(g, 'p2')).toBe(2);
  });
  it('Qixi: any black card as Dismantle', () => {
    const g = setup({ generals: ['ganning', 'guanyu', 'zhangfei'], hands: [[spade7slash], ['dodge'], []] });
    act(g, 'p1', { type: 'useCard', cardIds: [spade7slash], as: 'dismantle', skill: 'qixi', targets: ['p2'] });
    passNegates(g);
    act(g, 'p1', { type: 'pick', zone: 'hand' });
    expect(g.player('p2').hand).toHaveLength(0);
  });
  it('Keji: skip Discard phase if no Slash was used', () => {
    const g = setup({ generals: ['lumeng', 'guanyu', 'zhangfei'], hands: [['dodge', 'dodge', 'dodge', 'peach'], [], []], hp: [2] });
    endPlay(g, 'p1');
    expect(g.player('p1').hand).toHaveLength(6);
    expect(g.state.turn?.player).toBe('p2');
  });
  it('Keji does not apply after using a Slash', () => {
    const g = setup({ generals: ['lumeng', 'zhangliao', 'zhangfei'], hands: [['slash', 'dodge', 'dodge', 'dodge'], [], []], hp: [2] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    endPlay(g, 'p1');
    expectDecision(g, 'cards', 'p1');
  });
  it('Kurou: lose 1 HP, draw 2', () => {
    const g = setup({ generals: ['huanggai', 'guanyu', 'zhangfei'] });
    const before = g.player('p1').hand.length;
    act(g, 'p1', { type: 'skill', skill: 'kurou', cardIds: [], targets: [] });
    expect(hp(g, 'p1')).toBe(3);
    expect(g.player('p1').hand.length).toBe(before + 2);
  });
  it('Yingzi: draw 3 in the Draw phase', () => {
    const g = setup({ generals: ['zhouyu', 'guanyu', 'zhangfei'] });
    expect(g.player('p1').hand).toHaveLength(3);
  });
  it('Fanjian: wrong suit guess → 1 damage', () => {
    const g = setup({ generals: ['zhouyu', 'zhangliao', 'zhangfei'], hands: [[heartPeach], [], []] });
    // Zhou Yu's hand: ♥ Peach + drawn ♣ Dilu, ♥ Flying Lightning (+ Yingzi's extra card)
    const nonSpade = g.player('p1').hand.every((id) => getCard(id).suit !== 'spade');
    act(g, 'p1', { type: 'skill', skill: 'fanjian', cardIds: [], targets: ['p2'] });
    act(g, 'p2', { type: 'option', option: 'spade' });
    if (nonSpade) expect(hp(g, 'p2')).toBe(3);
    expect(g.player('p2').hand).toHaveLength(1);
  });
  it('Guose: a diamond card as Indulgence', () => {
    const g = setup({ generals: ['daqiao', 'guanyu', 'zhangfei'], hands: [[diamondDodge], [], []] });
    act(g, 'p1', { type: 'useCard', cardIds: [diamondDodge], as: 'indulgence', skill: 'guose', targets: ['p2'] });
    expect(g.player('p2').judge).toEqual([{ card: diamondDodge, as: 'indulgence' }]);
  });
  it('Liuli: redirect a Slash by discarding a card', () => {
    const g = setup({ generals: ['guanyu', 'daqiao', 'zhangliao'], hands: [['slash'], ['dodge'], []] });
    use(g, 'p1', 'slash', ['p2']);
    expectDecision(g, 'cards', 'p2');
    act(g, 'p2', { type: 'cards', cardIds: [cardIn(g, 'p2', 'dodge')], targets: ['p3'] });
    pass(g, 'p3');
    expect(hp(g, 'p3')).toBe(3);
    expect(hp(g, 'p2')).toBe(3);
  });
  it('Liuli cannot redirect back to the Slash user', () => {
    const g = setup({ generals: ['guanyu', 'daqiao', 'zhangliao'], hands: [['slash'], ['dodge'], []] });
    use(g, 'p1', 'slash', ['p2']);
    expect(g.dispatch('p2', { type: 'cards', cardIds: [cardIn(g, 'p2', 'dodge')], targets: ['p1'] })).toBeTruthy();
  });
  it('Qianxun: cannot be targeted by Steal or Indulgence', () => {
    const g = setup({ generals: ['guanyu', 'luxun', 'zhangfei'], hands: [['steal', 'indulgence'], ['dodge'], []] });
    expect(g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'steal')], as: 'steal', targets: ['p2'] })).toMatch(/Qianxun/);
    expect(g.dispatch('p1', { type: 'useCard', cardIds: [cardIn(g, 'p1', 'indulgence')], as: 'indulgence', targets: ['p2'] })).toMatch(/Qianxun/);
  });
  it('Lianying: draw 1 after losing the last hand card', () => {
    const g = setup({ generals: ['guanyu', 'luxun', 'zhangfei'], hands: [['slash'], ['dodge'], []] });
    use(g, 'p1', 'slash', ['p2']);
    respond(g, 'p2', 'dodge');
    expect(g.player('p2').hand).toHaveLength(1);
  });
  it('Jieyin: discard 2, you and an injured male each recover 1', () => {
    const g = setup({ generals: ['sunshangxiang', 'guanyu', 'zhenji'], hp: [2, 2] });
    const ids = g.player('p1').hand.slice(0, 2);
    expect(g.dispatch('p1', { type: 'skill', skill: 'jieyin', cardIds: ids, targets: ['p3'] })).toMatch(/male/);
    act(g, 'p1', { type: 'skill', skill: 'jieyin', cardIds: ids, targets: ['p2'] });
    expect([hp(g, 'p1'), hp(g, 'p2')]).toEqual([3, 3]);
  });
  it('Xiaoji: draw 2 when losing an equipment card', () => {
    const g = setup({ generals: ['guanyu', 'sunshangxiang', 'zhangfei'], hands: [['dismantle'], [], []], equips: [[], ['jueying'], []] });
    use(g, 'p1', 'dismantle', ['p2']);
    passNegates(g);
    act(g, 'p1', { type: 'pick', cardId: g.player('p2').equip.horsePlus! });
    expect(g.player('p2').hand).toHaveLength(2);
  });
});

describe('Qun skills', () => {
  it('Jijiu: outside his turn Hua Tuo uses a red card as Peach', () => {
    const g = setup({ generals: ['guanyu', 'zhangliao', 'huatuo'], roles: ['lord', 'rebel', 'loyalist'], hands: [['slash'], [], [heartDodge]], hp: [undefined, 1] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expectDecision(g, 'respond', 'p3');
    act(g, 'p3', { type: 'card', cardIds: [heartDodge], as: 'peach', skill: 'jijiu' });
    expect(g.player('p2').alive).toBe(true);
  });
  it('Qingnang: discard a hand card to heal an injured character', () => {
    const g = setup({ generals: ['huatuo', 'guanyu', 'zhangfei'], hp: [undefined, 2] });
    act(g, 'p1', { type: 'skill', skill: 'qingnang', cardIds: [g.player('p1').hand[0]], targets: ['p2'] });
    expect(hp(g, 'p2')).toBe(3);
  });
  it('Wushuang: two Dodges needed against Lu Bu\'s Slash', () => {
    const g = setup({ generals: ['lubu', 'zhangliao', 'zhangfei'], hands: [['slash'], ['dodge'], []] });
    use(g, 'p1', 'slash', ['p2']);
    respond(g, 'p2', 'dodge');
    expectDecision(g, 'respond', 'p2');
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(3);
  });
  it('Wushuang: opponents need two Slashes in a Duel', () => {
    const g = setup({ generals: ['lubu', 'zhangliao', 'zhangfei'], hands: [['duel'], ['slash'], []] });
    use(g, 'p1', 'duel', ['p2']);
    passNegates(g);
    respond(g, 'p2', 'slash');
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(3);
  });
  it('Lijian: two males Duel; the Duel cannot be Negated', () => {
    const g = setup({ generals: ['diaochan', 'guanyu', 'zhangfei'], hands: [[], ['negate'], []] });
    act(g, 'p1', { type: 'skill', skill: 'lijian', cardIds: [g.player('p1').hand[0]], targets: ['p2', 'p3'] });
    expectDecision(g, 'respond', 'p3'); // no Negate window opened
    pass(g, 'p3');
    expect(hp(g, 'p3')).toBe(3);
  });
  it('Biyue: draw 1 at the End phase', () => {
    const g = setup({ generals: ['diaochan', 'guanyu', 'zhangfei'] });
    const before = g.player('p1').hand.length;
    endPlay(g, 'p1');
    expect(g.player('p1').hand.length).toBe(before + 1);
  });
});

describe('skill interactions', () => {
  it('Eight Trigrams judgment can be altered by Guicai', () => {
    const g = setup({ generals: ['guanyu', 'zhangliao', 'simayi'], hands: [['slash'], [], [heartPeach]], equips: [[], ['eightDiagrams'], []], deckTop: ['dilu', 'zhuahuang', spade7slash] });
    use(g, 'p1', 'slash', ['p2']);
    act(g, 'p2', { type: 'respondSkill', skill: 'eightDiagrams' });
    expectDecision(g, 'cards', 'p3');
    act(g, 'p3', { type: 'cards', cardIds: [heartPeach] });
    expect(hp(g, 'p2')).toBe(4);
  });
  it('Jianxiong can take Lightning after being struck', () => {
    const g = setup({ generals: ['caocao', 'guanyu', 'zhangfei'], judges: [['lightning'], [], []], hp: [5], deckTop: [spade7slash, 'dilu', 'zhuahuang'] });
    passNegates(g);
    expect(hp(g, 'p1')).toBe(2);
    expect(handNames(g, 'p1')).toContain('lightning');
  });
  it('Multiple after-damage triggers: Yiji then dying order still correct', () => {
    const g = setup({ generals: ['lubu', 'guojia', 'zhangfei'], hands: [['slash'], [], []], hp: [undefined, 2] });
    use(g, 'p1', 'slash', ['p2']);
    pass(g, 'p2');
    expectDecision(g, 'yiji', 'p2');
  });
  it('Luoyi bonus applies to Duel damage', () => {
    const g = setup({ generals: ['xuchu', 'zhangliao', 'zhangfei'], hands: [['duel'], [], []], autoUse: false });
    yes(g, 'p1');
    use(g, 'p1', 'duel', ['p2']);
    passNegates(g);
    pass(g, 'p2');
    expect(hp(g, 'p2')).toBe(2);
  });
  it('declining an optional skill works', () => {
    const g = setup({ generals: ['xuchu', 'guanyu', 'zhangfei'], autoUse: false });
    no(g, 'p1');
    expect(g.player('p1').hand).toHaveLength(2);
  });
});
