// In-game rulebook text. Every section lists source ids from sources.ts.
export interface RuleSection {
  id: string;
  title: string;
  zh: string;
  body: string[];
  sources: string[];
}

export const RULE_SECTIONS: RuleSection[] = [
  {
    id: 'objective', title: 'Objective & Roles', zh: '身份',
    body: [
      'Every player secretly receives a role. Only the Lord (主公) reveals it at the start.',
      'Lord & Loyalists (忠臣) win when every Rebel and Renegade is dead.',
      'Rebels (反贼) win as soon as the Lord dies — even if all Rebels are already dead.',
      'The Renegade (内奸) wins only by being the last character alive: the Lord must die when the Renegade is the sole other survivor.',
      'Role counts — 4 players: 1 Lord, 1 Loyalist, 1 Rebel, 1 Renegade · 5: 1/1/2/1 · 6: 1/1/3/1 (or 1/1/2/2 with two Renegades) · 7: 1/2/3/1 · 8: 1/2/4/1 (or 1/2/3/2).',
      'Roles of dead players are revealed immediately. All roles are revealed at the end.',
    ],
    sources: ['zhwiki-sgs', 'wikipedia-lotk', 'bgg-lotk', 'double-renegade', 'englishsanguosha-roles'],
  },
  {
    id: 'setup', title: 'Setup & Choosing Generals', zh: '选将',
    body: [
      'The Lord chooses first from the three Lord generals (Cao Cao, Liu Bei, Sun Quan) plus two random generals. The choice is shown to everyone.',
      'Every other player then privately chooses from their own set of random generals (3 by default; the host may change this).',
      'With 5 or more players the Lord gets +1 maximum HP.',
      'Everyone draws 4 starting cards. The Lord takes the first turn; play continues in seat order.',
    ],
    sources: ['9game-lord-select', 'zhwiki-sgs', 'sohu-basic-rules'],
  },
  {
    id: 'phases', title: 'Turn Phases', zh: '回合',
    body: [
      '1. Start phase (准备阶段) — some skills trigger (Guanxing, Luoshen).',
      '2. Judgment phase (判定阶段) — delayed tricks in your judgment area resolve, most recently placed first.',
      '3. Draw phase (摸牌阶段) — draw 2 cards.',
      '4. Play phase (出牌阶段) — use any cards and active skills. Normally only one Slash per Play phase.',
      '5. Discard phase (弃牌阶段) — discard down to your current HP (your hand limit).',
      '6. End phase (结束阶段) — some skills trigger (Biyue).',
    ],
    sources: ['wmzy-repo', 'sohu-basic-rules', 'bgg-rules-intro'],
  },
  {
    id: 'distance', title: 'Distance & Attack Range', zh: '距离',
    body: [
      'Distance counts seats to the target around the table (the shorter way), skipping dead players.',
      'A +1 horse makes others count their distance to you as 1 more. A −1 horse makes your distance to others 1 less. Distance is never below 1.',
      'Your attack range is 1, or your weapon\'s range. You can Slash a character whose distance from you is within your attack range.',
      '"Distance 1" effects (Steal) use distance, not attack range.',
    ],
    sources: ['guozhan-cards', 'wmzy-repo'],
  },
  {
    id: 'cards', title: 'Card Categories', zh: '游戏牌',
    body: [
      'Basic cards: Slash 杀, Dodge 闪, Peach 桃.',
      'Tricks (锦囊): instant tricks resolve immediately and can be Negated; delayed tricks (Indulgence, Lightning) sit in a judgment area until that player\'s Judgment phase.',
      'Equipment: weapon, armor, +1 horse, −1 horse. Equipping a new item in an occupied slot discards the old one.',
      'The Standard deck has 104 cards plus 4 EX cards (Frost Blade ♠2, Renwang Shield ♣2, Lightning ♥Q, Negate ♦Q). Every card has a fixed suit and rank, which matter for judgments and skills.',
    ],
    sources: ['guozhan-cards', 'yoka-cards', 'bwiki-standard-cards', 'wmzy-deck'],
  },
  {
    id: 'use-play', title: 'Use vs. Play', zh: '使用与打出',
    body: [
      'You "use" (使用) a card when it has its own effect and targets (Slash, Dodge against a Slash, Peach).',
      'You "play" (打出) a card when an effect asks for it (Slashes in a Duel or against Barbarian Invasion).',
      'Some skills care about the difference (e.g. Keji checks Slashes used or played during your Play phase).',
    ],
    sources: ['wmzy-repo'],
  },
  {
    id: 'dying', title: 'Damage, Dying & Rescue', zh: '濒死',
    body: [
      'When a character\'s HP drops to 0 or lower they are dying (濒死). They need enough Peaches to get back above 0 HP — at −1 HP they need 2.',
      'Starting with the current turn player and going around the table, each player may use Peaches on them. The dying player may use their own Peaches when their turn in this order comes.',
      'If nobody saves them, they die: their role is revealed and all of their cards are discarded.',
    ],
    sources: ['sgs-club-dying', 'baike-peach'],
  },
  {
    id: 'death', title: 'Death, Rewards & Penalties', zh: '奖惩',
    body: [
      'Whoever kills a Rebel (the source of the fatal damage) draws 3 cards.',
      'If the Lord kills a Loyalist, the Lord discards all hand and equipment cards.',
      'Victory is checked immediately after every death. If the current player dies, their turn ends at once.',
      'Deaths caused by Lightning have no killer and give no reward.',
    ],
    sources: ['wikipedia-lotk', 'bgg-lotk', 'baidu-renegade'],
  },
  {
    id: 'judgment', title: 'Judgments', zh: '判定',
    body: [
      'A judgment reveals the top card of the deck; its suit, colour or rank decides the outcome.',
      'Before it takes effect, skills like Guicai (Sima Yi) can replace it with a hand card.',
      'Indulgence: unless the result is ♥, skip your Play phase. Lightning: ♠2–♠9 deals 3 thunder damage; otherwise it moves to the next player.',
      'Eight Trigrams: when you need a Dodge, a red judgment counts as one.',
    ],
    sources: ['baike-lightning', 'faq-print', 'guozhan-cards'],
  },
  {
    id: 'negate', title: 'Negate', zh: '无懈可击',
    body: [
      'Whenever a trick is about to take effect on a target, anyone may use Negate to cancel it for that target. AoE tricks are Negated per target.',
      'A Negate can itself be Negated (counter-negate), and so on.',
      'A delayed trick is checked for Negate when it resolves in the Judgment phase. A Negated Lightning simply moves on.',
    ],
    sources: ['douban-faq', 'guozhan-cards'],
  },
];
