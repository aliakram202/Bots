export type SkillType = 'trigger' | 'active' | 'conversion' | 'compulsory' | 'lord';

export interface SkillDefinition {
  id: string;
  en: string; // pinyin name shown first
  gloss: string; // English meaning
  zh: string;
  type: SkillType;
  lord?: boolean;
  compulsory?: boolean;
  /** English rules text. */
  text: string;
  /** Official Chinese text (sanguosha.com hero page as quoted by wmzy research). */
  textZh: string;
  timing: string;
  limit?: string;
  general: string;
  sources: string[];
  notes?: string;
}

const s = (d: Omit<SkillDefinition, 'sources'> & { hero: number; extraSources?: string[] }): SkillDefinition => {
  const { hero, extraSources, ...rest } = d;
  return { ...rest, sources: [`sgs-hero-${hero}`, 'wmzy-repo', ...(extraSources ?? [])] };
};

export const SKILLS: SkillDefinition[] = [
  // ── Wei ──
  s({ id: 'jianxiong', en: 'Jianxiong', gloss: 'Villainous Hero', zh: '奸雄', type: 'trigger', general: 'caocao', hero: 15,
    text: 'After you take damage, you may obtain the card(s) that caused it.',
    textZh: '当你受到伤害后，你可以获得造成此伤害的牌。', timing: 'After you take damage' }),
  s({ id: 'hujia', en: 'Hujia', gloss: 'Royal Escort', zh: '护驾', type: 'lord', lord: true, general: 'caocao', hero: 15,
    text: 'Lord skill. When you need to use or play a Dodge, you may ask the other Wei characters, in seat order, to play a Dodge on your behalf (treated as used/played by you).',
    textZh: '主公技，其他魏势力角色可以在你需要时代替你使用或打出【闪】（视为由你使用或打出）。', timing: 'When you need a Dodge' }),
  s({ id: 'fankui', en: 'Fankui', gloss: 'Retaliation', zh: '反馈', type: 'trigger', general: 'simayi', hero: 16,
    text: 'After you take damage, you may obtain one card (hand or equipment) from the source of that damage.',
    textZh: '当你受到伤害后，你可以获得伤害来源的一张牌。', timing: 'After you take damage' }),
  s({ id: 'guicai', en: 'Guicai', gloss: 'Demonic Talent', zh: '鬼才', type: 'trigger', general: 'simayi', hero: 16,
    text: "Before any judgment card takes effect, you may play one of your hand cards to replace it.",
    textZh: '当一张判定牌生效前，你可以用一张手牌代替之。', timing: 'Before any judgment takes effect' }),
  s({ id: 'ganglie', en: 'Ganglie', gloss: 'Unyielding', zh: '刚烈', type: 'trigger', general: 'xiahoudun', hero: 17,
    text: 'After you take damage, you may perform a judgment. If it is not a heart, the source chooses: discard 2 hand cards, or take 1 damage from you.',
    textZh: '当你受到伤害后，你可以判定，若结果不为红桃，伤害来源选择弃置两张手牌或受到1点伤害。', timing: 'After you take damage' }),
  s({ id: 'tuxi', en: 'Tuxi', gloss: 'Sudden Raid', zh: '突袭', type: 'trigger', general: 'zhangliao', hero: 18,
    text: 'Draw phase: instead of drawing, you may take one hand card from each of up to two other characters.',
    textZh: '摸牌阶段，你可以改为获得至多两名角色的各一张手牌。', timing: 'Draw phase' }),
  s({ id: 'luoyi', en: 'Luoyi', gloss: 'Bare-chested', zh: '裸衣', type: 'trigger', general: 'xuchu', hero: 19,
    text: 'Draw phase: you may draw one fewer card. If you do, damage dealt by your Slash or Duel this turn is increased by 1.',
    textZh: '摸牌阶段，你可以少摸一张牌，然后你本回合使用【杀】或【决斗】造成的伤害+1。', timing: 'Draw phase' }),
  s({ id: 'tiandu', en: 'Tiandu', gloss: 'Envy of Heaven', zh: '天妒', type: 'trigger', general: 'guojia', hero: 20,
    text: 'After one of your judgment cards takes effect, you may obtain it.',
    textZh: '当你的判定牌生效后，你可以获得此牌。', timing: 'After your judgment takes effect' }),
  s({ id: 'yiji', en: 'Yiji', gloss: 'Bequeathed Strategy', zh: '遗计', type: 'trigger', general: 'guojia', hero: 20,
    text: 'Each time you take 1 point of damage, you may look at the top two cards of the deck and give them to any characters (including yourself).',
    textZh: '当你受到1点伤害后，你可以观看牌堆顶的两张牌，然后将这些牌交给任意角色。', timing: 'After each 1 damage taken' }),
  s({ id: 'qingguo', en: 'Qingguo', gloss: 'Nation-toppling Beauty', zh: '倾国', type: 'conversion', general: 'zhenji', hero: 21,
    text: 'You may use or play any black hand card as a Dodge.',
    textZh: '你可以将一张黑色手牌当【闪】使用或打出。', timing: 'Whenever you need a Dodge' }),
  s({ id: 'luoshen', en: 'Luoshen', gloss: 'Goddess of the Luo River', zh: '洛神', type: 'trigger', general: 'zhenji', hero: 21,
    text: 'Start phase: you may perform a judgment. If it is black, obtain it and you may repeat. Stop when a red card is revealed (it is discarded).',
    textZh: '准备阶段，你可以进行判定，若结果为黑色，你获得此牌，然后你可以重复此流程。', timing: 'Start phase' }),
  // ── Shu ──
  s({ id: 'rende', en: 'Rende', gloss: 'Benevolence', zh: '仁德', type: 'active', general: 'liubei', hero: 1, extraSources: ['sgs-english-walkthrough'],
    text: 'Play phase: you may give any number of hand cards to other characters. When you have given away a total of 2 or more cards this phase, you recover 1 HP (once per phase).',
    textZh: '出牌阶段，你可以将任意张手牌交给其他角色，然后你本阶段以此法给出第二张牌或更多时，你回复1点体力。', timing: 'Play phase', limit: 'Unlimited uses; healing once per phase' }),
  s({ id: 'jijiang', en: 'Jijiang', gloss: 'Rouse', zh: '激将', type: 'lord', lord: true, general: 'liubei', hero: 1,
    text: 'Lord skill. When you need to use or play a Slash, you may ask the other Shu characters, in seat order, to play a Slash on your behalf (treated as used/played by you).',
    textZh: '主公技，其他蜀势力角色可以在你需要时代替你使用或打出【杀】（视为由你使用或打出）。', timing: 'When you need a Slash' }),
  s({ id: 'wusheng', en: 'Wusheng', gloss: 'Saint of War', zh: '武圣', type: 'conversion', general: 'guanyu', hero: 2,
    text: 'You may use or play any red card (hand or equipment) as a Slash.',
    textZh: '你可以将一张红色牌当【杀】使用或打出。', timing: 'Whenever you use or play a Slash' }),
  s({ id: 'paoxiao', en: 'Paoxiao', gloss: 'Roar', zh: '咆哮', type: 'compulsory', compulsory: true, general: 'zhangfei', hero: 3,
    text: 'Compulsory: you may use any number of Slashes.',
    textZh: '锁定技，你使用【杀】无次数限制。', timing: 'Always' }),
  s({ id: 'guanxing', en: 'Guanxing', gloss: 'Stargazing', zh: '观星', type: 'trigger', general: 'zhugeliang', hero: 4,
    text: 'Start phase: you may look at the top X cards of the deck (X = number of living characters, max 5), then put any of them back on top in any order and the rest on the bottom in any order.',
    textZh: '准备阶段，你可以观看牌堆顶的X张牌（X为存活角色数且至多为5），然后以任意顺序置于牌堆顶或牌堆底。', timing: 'Start phase' }),
  s({ id: 'kongcheng', en: 'Kongcheng', gloss: 'Empty City', zh: '空城', type: 'compulsory', compulsory: true, general: 'zhugeliang', hero: 4,
    text: 'Compulsory: while you have no hand cards, you cannot be targeted by Slash or Duel.',
    textZh: '锁定技，若你没有手牌，你不能成为【杀】或【决斗】的目标。', timing: 'When being targeted' }),
  s({ id: 'longdan', en: 'Longdan', gloss: 'Dragon Courage', zh: '龙胆', type: 'conversion', general: 'zhaoyun', hero: 5,
    text: 'You may use or play a Slash as a Dodge, or a Dodge as a Slash.',
    textZh: '你可以将一张【杀】当【闪】、【闪】当【杀】使用或打出。', timing: 'Whenever you need a Slash or Dodge' }),
  s({ id: 'mashu', en: 'Mashu', gloss: 'Horsemanship', zh: '马术', type: 'compulsory', compulsory: true, general: 'machao', hero: 6,
    text: 'Compulsory: your distance to other characters is reduced by 1.',
    textZh: '锁定技，你计算与其他角色的距离-1。', timing: 'Always' }),
  s({ id: 'tieji', en: 'Tieji', gloss: 'Iron Cavalry', zh: '铁骑', type: 'trigger', general: 'machao', hero: 6,
    text: 'After you target a character with a Slash, you may perform a judgment. If it is red, that character cannot use a Dodge against this Slash.',
    textZh: '当你使用【杀】指定目标后，你可以判定，若为红色，其不能使用【闪】响应此【杀】。', timing: 'After declaring Slash targets' }),
  s({ id: 'jizhi', en: 'Jizhi', gloss: 'Wisdom', zh: '集智', type: 'trigger', general: 'huangyueying', hero: 7,
    text: 'When you use a non-delayed trick card, you may draw 1 card.',
    textZh: '当你使用普通锦囊牌时，你可以摸一张牌。', timing: 'When you use an instant trick' }),
  s({ id: 'qicai', en: 'Qicai', gloss: 'Genius', zh: '奇才', type: 'compulsory', compulsory: true, general: 'huangyueying', hero: 7,
    text: 'Compulsory: your trick cards have no distance limit.',
    textZh: '锁定技，你使用锦囊牌无距离限制。', timing: 'Always' }),
  // ── Wu ──
  s({ id: 'zhiheng', en: 'Zhiheng', gloss: 'Balance of Power', zh: '制衡', type: 'active', general: 'sunquan', hero: 8,
    text: 'Once per Play phase: discard any number of cards (hand and/or equipment), then draw the same number.',
    textZh: '出牌阶段限一次，你可以弃置任意张牌，然后摸等量张牌。', timing: 'Play phase', limit: 'Once per Play phase' }),
  s({ id: 'jiuyuan', en: 'Jiuyuan', gloss: 'Rescue', zh: '救援', type: 'lord', lord: true, compulsory: true, general: 'sunquan', hero: 8,
    text: 'Lord skill, compulsory. When another Wu character uses a Peach on you while you are dying, you recover 1 additional HP.',
    textZh: '主公技，锁定技，其他吴势力角色对你使用【桃】的回复值+1。', timing: 'While dying',
    notes: 'Another character can only use a Peach on you while you are dying, so the bonus only ever applies to rescues.' }),
  s({ id: 'qixi', en: 'Qixi', gloss: 'Surprise Raid', zh: '奇袭', type: 'conversion', general: 'ganning', hero: 9,
    text: 'You may use any black card (hand or equipment) as Dismantle.',
    textZh: '你可以将一张黑色牌当【过河拆桥】使用。', timing: 'Play phase' }),
  s({ id: 'keji', en: 'Keji', gloss: 'Self-restraint', zh: '克己', type: 'trigger', general: 'lumeng', hero: 10,
    text: 'If you did not use or play any Slash during this turn\'s Play phase, you may skip your Discard phase.',
    textZh: '若你未于本回合出牌阶段使用或打出过【杀】，你可以跳过弃牌阶段。', timing: 'Before Discard phase' }),
  s({ id: 'kurou', en: 'Kurou', gloss: 'Self-injury', zh: '苦肉', type: 'active', general: 'huanggai', hero: 11,
    text: 'Play phase: you may lose 1 HP, then draw 2 cards. No limit on uses.',
    textZh: '出牌阶段，你可以失去1点体力，然后摸两张牌。', timing: 'Play phase', limit: 'Unlimited' }),
  s({ id: 'yingzi', en: 'Yingzi', gloss: 'Heroic Spirit', zh: '英姿', type: 'trigger', general: 'zhouyu', hero: 12,
    text: 'Draw phase: you may draw 1 additional card.',
    textZh: '摸牌阶段，你可以多摸一张牌。', timing: 'Draw phase' }),
  s({ id: 'fanjian', en: 'Fanjian', gloss: 'Sow Discord', zh: '反间', type: 'active', general: 'zhouyu', hero: 12,
    text: 'Once per Play phase: choose another character. They name a suit, then take one of your hand cards (blindly) and reveal it. If its suit differs from the named suit, you deal 1 damage to them.',
    textZh: '出牌阶段限一次，你可以令一名其他角色选择一种花色，令其获得并展示你的一张手牌，若此牌花色与其选择的花色不同，你对其造成1点伤害。', timing: 'Play phase', limit: 'Once per Play phase' }),
  s({ id: 'guose', en: 'Guose', gloss: 'National Beauty', zh: '国色', type: 'conversion', general: 'daqiao', hero: 13,
    text: 'You may use any diamond card (hand or equipment) as Indulgence.',
    textZh: '你可以将一张方片牌当【乐不思蜀】使用。', timing: 'Play phase' }),
  s({ id: 'liuli', en: 'Liuli', gloss: 'Displacement', zh: '流离', type: 'trigger', general: 'daqiao', hero: 13,
    text: 'When you become the target of a Slash, you may discard one card and redirect the Slash to another character within your attack range (not the Slash\'s user).',
    textZh: '当你成为【杀】的目标时，你可以弃置一张牌并将此【杀】转移给你攻击范围内的一名其他角色。', timing: 'When targeted by Slash', extraSources: ['faq-print', 'qsgs-repo'],
    notes: 'The Slash user cannot be chosen as the new target (FAQ ruling; QSanguosha behaves the same).' }),
  s({ id: 'qianxun', en: 'Qianxun', gloss: 'Modesty', zh: '谦逊', type: 'compulsory', compulsory: true, general: 'luxun', hero: 14,
    text: 'Compulsory: you cannot be targeted by Steal or Indulgence.',
    textZh: '锁定技，你不能成为【顺手牵羊】和【乐不思蜀】的目标。', timing: 'When being targeted' }),
  s({ id: 'lianying', en: 'Lianying', gloss: 'One After Another', zh: '连营', type: 'trigger', general: 'luxun', hero: 14,
    text: 'After you lose your last hand card, you may draw 1 card.',
    textZh: '当你失去最后的手牌后，你可以摸一张牌。', timing: 'After losing last hand card' }),
  s({ id: 'jieyin', en: 'Jieyin', gloss: 'Marriage', zh: '结姻', type: 'active', general: 'sunshangxiang', hero: 25,
    text: 'Once per Play phase: discard 2 hand cards and choose an injured male character. You and that character each recover 1 HP.',
    textZh: '出牌阶段限一次，你可以弃置两张手牌，令你与一名已受伤的男性角色各回复1点体力。', timing: 'Play phase', limit: 'Once per Play phase' }),
  s({ id: 'xiaoji', en: 'Xiaoji', gloss: 'Warrior Woman', zh: '枭姬', type: 'trigger', general: 'sunshangxiang', hero: 25,
    text: 'When you lose a card from your equipment area, you may draw 2 cards.',
    textZh: '当你失去装备区里的一张牌后，你可以摸两张牌。', timing: 'After losing an equipment card' }),
  // ── Qun ──
  s({ id: 'jijiu', en: 'Jijiu', gloss: 'First Aid', zh: '急救', type: 'conversion', general: 'huatuo', hero: 22,
    text: 'Outside your turn, you may use any red card (hand or equipment) as a Peach.',
    textZh: '你的回合外，你可以将一张红色牌当【桃】使用。', timing: 'Outside your turn' }),
  s({ id: 'qingnang', en: 'Qingnang', gloss: 'Green Satchel', zh: '青囊', type: 'active', general: 'huatuo', hero: 22,
    text: 'Once per Play phase: discard a hand card and choose an injured character. They recover 1 HP.',
    textZh: '出牌阶段限一次，你可以弃置一张手牌令一名角色回复1点体力。', timing: 'Play phase', limit: 'Once per Play phase' }),
  s({ id: 'wushuang', en: 'Wushuang', gloss: 'Peerless', zh: '无双', type: 'compulsory', compulsory: true, general: 'lubu', hero: 23,
    text: 'Compulsory: a target of your Slash needs two Dodges to cancel it. A character in a Duel with you must play two Slashes each time.',
    textZh: '锁定技，你使用的【杀】需两张【闪】才能抵消；与你【决斗】的角色每次需打出两张【杀】。', timing: 'Always' }),
  s({ id: 'lijian', en: 'Lijian', gloss: 'Seed of Animosity', zh: '离间', type: 'active', general: 'diaochan', hero: 24,
    text: 'Once per Play phase: discard a card and choose two male characters. The first is treated as using a Duel on the second. This Duel cannot be Negated.',
    textZh: '出牌阶段限一次，你可以弃置一张牌令一名男性角色视为对另一名男性角色使用一张【决斗】（不能被【无懈可击】抵消）。', timing: 'Play phase', limit: 'Once per Play phase' }),
  s({ id: 'biyue', en: 'Biyue', gloss: 'Eclipse the Moon', zh: '闭月', type: 'trigger', general: 'diaochan', hero: 24,
    text: 'End phase: you may draw 1 card.',
    textZh: '结束阶段，你可以摸一张牌。', timing: 'End phase' }),
];

export const SKILLS_BY_ID: Record<string, SkillDefinition> = Object.fromEntries(SKILLS.map((x) => [x.id, x]));

export function skillDef(id: string): SkillDefinition {
  const d = SKILLS_BY_ID[id];
  if (!d) throw new Error(`Unknown skill ${id}`);
  return d;
}
