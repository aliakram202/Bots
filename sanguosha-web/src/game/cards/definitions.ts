import type { CardCategory, CardName, CardSubtype, EquipSlot } from '../engine/types';

export interface CardDefinition {
  name: CardName;
  en: string;
  zh: string;
  category: CardCategory;
  subtype: CardSubtype;
  /** Weapon attack range. */
  range?: number;
  /** Exact effect text shown to players. */
  text: string;
  /** Short helper for beginners. */
  hint: string;
  sources: string[];
  notes?: string;
}

const CARD_SRC = ['guozhan-cards', 'yoka-cards', 'bwiki-standard-cards', 'wmzy-deck'];

const defs: CardDefinition[] = [
  // ── Basic ──
  {
    name: 'slash', en: 'Slash', zh: '杀', category: 'basic', subtype: 'basic',
    text: 'Play phase: target one other character within your attack range. The target must use a Dodge or take 1 damage from you. Normally limited to once per Play phase.',
    hint: 'Attack a player in range. They need a Dodge.',
    sources: CARD_SRC,
  },
  {
    name: 'dodge', en: 'Dodge', zh: '闪', category: 'basic', subtype: 'basic',
    text: 'Use when a Slash targets you to cancel that Slash. Can also be played whenever an effect asks you to play a Dodge (e.g. Hail of Arrows). Cannot be used proactively.',
    hint: 'Defensive: cancels a Slash or Hail of Arrows.',
    sources: CARD_SRC,
  },
  {
    name: 'peach', en: 'Peach', zh: '桃', category: 'basic', subtype: 'basic',
    text: 'Play phase: recover 1 HP if you are injured. When any character is dying (HP ≤ 0), you may use a Peach on them so they recover 1 HP.',
    hint: 'Heal 1 HP; can save a dying player.',
    sources: [...CARD_SRC, 'baike-peach'],
  },
  // ── Instant tricks ──
  {
    name: 'duel', en: 'Duel', zh: '决斗', category: 'trick', subtype: 'instantTrick',
    text: 'Target one other character. Starting with the target, the two of you take turns playing a Slash. The first who does not play a Slash takes 1 damage from the other.',
    hint: 'Slash-off: first one without a Slash takes 1 damage.',
    sources: CARD_SRC,
  },
  {
    name: 'dismantle', en: 'Dismantle', zh: '过河拆桥', category: 'trick', subtype: 'instantTrick',
    text: 'Target one other character with at least one card in their hand, equipment or judgment area. Discard one card from any of those areas (a hand card is chosen blindly). No distance limit.',
    hint: 'Destroy one of their cards. Any distance.',
    sources: CARD_SRC,
  },
  {
    name: 'steal', en: 'Steal', zh: '顺手牵羊', category: 'trick', subtype: 'instantTrick',
    text: 'Target one other character at distance 1 who has at least one card in their hand, equipment or judgment area. Take one card from any of those areas into your hand.',
    hint: 'Take one of their cards. Distance 1 only.',
    sources: CARD_SRC,
  },
  {
    name: 'exNihilo', en: 'Something from Nothing', zh: '无中生有', category: 'trick', subtype: 'instantTrick',
    text: 'Use on yourself: draw 2 cards.',
    hint: 'Draw 2 cards.',
    sources: CARD_SRC,
  },
  {
    name: 'barbarians', en: 'Barbarian Invasion', zh: '南蛮入侵', category: 'trick', subtype: 'instantTrick',
    text: 'Targets all other characters. In seat order each target must play a Slash or take 1 damage from you.',
    hint: 'Everyone else plays a Slash or takes 1 damage.',
    sources: CARD_SRC,
  },
  {
    name: 'arrows', en: 'Hail of Arrows', zh: '万箭齐发', category: 'trick', subtype: 'instantTrick',
    text: 'Targets all other characters. In seat order each target must play a Dodge or take 1 damage from you.',
    hint: 'Everyone else plays a Dodge or takes 1 damage.',
    sources: CARD_SRC,
  },
  {
    name: 'peachGarden', en: 'Peach Garden Oath', zh: '桃园结义', category: 'trick', subtype: 'instantTrick',
    text: 'Targets all characters (starting with you). Each target recovers 1 HP.',
    hint: 'Everyone recovers 1 HP.',
    sources: CARD_SRC,
    notes: 'Characters at full HP are skipped (no effect possible), so no Negate window is opened for them.',
  },
  {
    name: 'harvest', en: 'Bountiful Harvest', zh: '五谷丰登', category: 'trick', subtype: 'instantTrick',
    text: 'Reveal cards from the top of the deck equal to the number of living characters. Starting with you, each character chooses one of them and adds it to their hand.',
    hint: 'Everyone picks one revealed card, you first.',
    sources: CARD_SRC,
  },
  {
    name: 'borrowedSword', en: 'Borrowed Sword', zh: '借刀杀人', category: 'trick', subtype: 'instantTrick',
    text: 'Target one other character with a weapon equipped, and choose another character within their attack range. The target must use a Slash against that character, otherwise they give you their weapon.',
    hint: 'Force an armed player to Slash someone, or take their weapon.',
    sources: CARD_SRC,
  },
  {
    name: 'negate', en: 'Negate', zh: '无懈可击', category: 'trick', subtype: 'instantTrick',
    text: 'Use when a trick is about to take effect on one target: cancel its effect on that target. A Negate can itself be Negated.',
    hint: 'Cancel a trick on one target. Can counter another Negate.',
    sources: CARD_SRC,
  },
  // ── Delayed tricks ──
  {
    name: 'indulgence', en: 'Indulgence', zh: '乐不思蜀', category: 'trick', subtype: 'delayedTrick',
    text: "Place in another character's judgment area. In their Judgment phase they perform a judgment: unless it is a heart (♥), they skip their Play phase. The card is then discarded.",
    hint: 'Target likely skips their Play phase (75%).',
    sources: CARD_SRC,
  },
  {
    name: 'lightning', en: 'Lightning', zh: '闪电', category: 'trick', subtype: 'delayedTrick',
    text: 'Place in your own judgment area. In the Judgment phase of whoever holds it, perform a judgment: if the result is ♠2–♠9 they take 3 thunder damage (no source) and Lightning is discarded; otherwise it moves to the next living player\'s judgment area.',
    hint: 'A bomb passed around: ♠2–9 deals 3 damage.',
    sources: [...CARD_SRC, 'baike-lightning'],
  },
  // ── Weapons ──
  {
    name: 'crossbow', en: 'Zhuge Crossbow', zh: '诸葛连弩', category: 'equipment', subtype: 'weapon', range: 1,
    text: 'Attack range 1. During your Play phase you may use any number of Slashes.',
    hint: 'Unlimited Slashes.', sources: CARD_SRC,
  },
  {
    name: 'qinggang', en: 'Qinggang Sword', zh: '青釭剑', category: 'equipment', subtype: 'weapon', range: 2,
    text: "Attack range 2. Compulsory: your Slash ignores the target's armor.",
    hint: 'Slash ignores armor.', sources: CARD_SRC,
  },
  {
    name: 'doubleSwords', en: 'Yin-Yang Swords', zh: '雌雄双股剑', category: 'equipment', subtype: 'weapon', range: 2,
    text: 'Attack range 2. When you use a Slash targeting a character of the opposite gender, you may make them choose: discard a hand card, or let you draw 1 card.',
    hint: 'vs. opposite gender: they discard or you draw.', sources: [...CARD_SRC, 'baike-doubleswords'],
  },
  {
    name: 'iceSword', en: 'Frost Blade', zh: '寒冰剑', category: 'equipment', subtype: 'weapon', range: 2,
    text: 'Attack range 2. When your Slash would deal damage, you may prevent that damage and instead discard 2 cards from the target (one at a time, hand cards blindly).',
    hint: 'Trade Slash damage for 2 of their cards.', sources: [...CARD_SRC, 'baike-icesword'],
    notes: 'EX card (♠2).',
  },
  {
    name: 'greenDragon', en: 'Green Dragon Blade', zh: '青龙偃月刀', category: 'equipment', subtype: 'weapon', range: 3,
    text: 'Attack range 3. When your Slash is cancelled by a Dodge, you may immediately use another Slash against the same target (does not count toward the Slash limit).',
    hint: 'Dodged? Slash again.', sources: [...CARD_SRC, 'sina-greendragon'],
  },
  {
    name: 'serpentSpear', en: 'Serpent Spear', zh: '丈八蛇矛', category: 'equipment', subtype: 'weapon', range: 3,
    text: 'Attack range 3. You may use or play any two hand cards as a Slash.',
    hint: 'Two hand cards = one Slash.', sources: CARD_SRC,
  },
  {
    name: 'axe', en: 'Rock Cleaving Axe', zh: '贯石斧', category: 'equipment', subtype: 'weapon', range: 3,
    text: 'Attack range 3. When your Slash is cancelled by a Dodge, you may discard two cards (hand or other equipment) to make the Slash hit anyway.',
    hint: 'Pay 2 cards to force a hit.', sources: CARD_SRC,
  },
  {
    name: 'halberd', en: 'Sky Piercing Halberd', zh: '方天画戟', category: 'equipment', subtype: 'weapon', range: 4,
    text: 'Attack range 4. When the Slash you use is your last hand card, you may choose up to two additional targets.',
    hint: 'Last-card Slash hits up to 3.', sources: CARD_SRC,
  },
  {
    name: 'kylinBow', en: 'Kylin Bow', zh: '麒麟弓', category: 'equipment', subtype: 'weapon', range: 5,
    text: "Attack range 5. When your Slash deals damage, you may discard one of the target's horses.",
    hint: 'Shoot down a horse.', sources: CARD_SRC,
  },
  // ── Armor ──
  {
    name: 'eightDiagrams', en: 'Eight Trigrams', zh: '八卦阵', category: 'equipment', subtype: 'armor',
    text: 'When you need to use or play a Dodge, you may perform a judgment: if red, you are treated as having used/played a Dodge.',
    hint: 'Free 50% Dodge.', sources: CARD_SRC,
  },
  {
    name: 'renwangShield', en: 'Renwang Shield', zh: '仁王盾', category: 'equipment', subtype: 'armor',
    text: 'Compulsory: black Slashes have no effect on you.',
    hint: 'Immune to black Slash.', sources: CARD_SRC, notes: 'EX card (♣2).',
  },
  // ── Horses ──
  { name: 'jueying', en: 'Shadowrunner', zh: '绝影', category: 'equipment', subtype: 'horsePlus', text: '+1 horse: other characters calculate their distance to you as +1.', hint: 'Harder to reach.', sources: CARD_SRC },
  { name: 'dilu', en: 'Dilu', zh: '的卢', category: 'equipment', subtype: 'horsePlus', text: '+1 horse: other characters calculate their distance to you as +1.', hint: 'Harder to reach.', sources: CARD_SRC },
  { name: 'zhuahuang', en: 'Flying Lightning', zh: '爪黄飞电', category: 'equipment', subtype: 'horsePlus', text: '+1 horse: other characters calculate their distance to you as +1.', hint: 'Harder to reach.', sources: CARD_SRC },
  { name: 'chitu', en: 'Red Hare', zh: '赤兔', category: 'equipment', subtype: 'horseMinus', text: '−1 horse: you calculate your distance to other characters as −1.', hint: 'Reach further.', sources: CARD_SRC },
  { name: 'dayuan', en: 'Dayuan', zh: '大宛', category: 'equipment', subtype: 'horseMinus', text: '−1 horse: you calculate your distance to other characters as −1.', hint: 'Reach further.', sources: CARD_SRC },
  { name: 'zixing', en: 'Violet Stallion', zh: '紫骍', category: 'equipment', subtype: 'horseMinus', text: '−1 horse: you calculate your distance to other characters as −1.', hint: 'Reach further.', sources: CARD_SRC },
];

export const CARD_DEFS: Record<CardName, CardDefinition> = Object.fromEntries(
  defs.map((d) => [d.name, d]),
) as Record<CardName, CardDefinition>;

export function cardDef(name: CardName): CardDefinition {
  return CARD_DEFS[name];
}

export function equipSlotOf(name: CardName): EquipSlot | null {
  const st = CARD_DEFS[name].subtype;
  if (st === 'weapon' || st === 'armor' || st === 'horsePlus' || st === 'horseMinus') return st;
  return null;
}

export function isInstantTrick(name: CardName): boolean {
  return CARD_DEFS[name].subtype === 'instantTrick';
}
export function isTrick(name: CardName): boolean {
  return CARD_DEFS[name].category === 'trick';
}
