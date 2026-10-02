// Research source registry. Every rule/card/general entry references ids from here.
// See docs/SOURCES.md (generated from this file + hand-written notes).

export type SourceKind = 'official' | 'secondary' | 'implementation';

export interface SourceRef {
  id: string;
  title: string;
  url: string;
  kind: SourceKind;
  /** How the source was consulted during research. */
  access: 'cloned' | 'search-snippet' | 'cited-by-implementation';
  note?: string;
}

const hero = (n: number, zh: string): SourceRef => ({
  id: `sgs-hero-${n}`,
  title: `三国杀OL official hero page — ${zh}`,
  url: `https://www.sanguosha.com/hero/${n}`,
  kind: 'official',
  access: 'cited-by-implementation',
  note: 'Skill text quoted verbatim in wmzy/sanguosha docs/research/武将技能 (direct fetch was blocked by this environment\'s network policy).',
});

export const SOURCES: Record<string, SourceRef> = {
  'wmzy-repo': {
    id: 'wmzy-repo',
    title: 'wmzy/sanguosha — React + TypeScript + Hono web implementation (MIT)',
    url: 'https://github.com/wmzy/sanguosha',
    kind: 'implementation',
    access: 'cloned',
    note: 'MIT licensed. Used as a cross-check for deck table and skill text; no code copied verbatim.',
  },
  'wmzy-deck': {
    id: 'wmzy-deck',
    title: 'wmzy/sanguosha src/engine/core/deck.ts — Standard deck table (cites BWIKI 标准包卡牌)',
    url: 'https://github.com/wmzy/sanguosha/blob/main/src/engine/core/deck.ts',
    kind: 'implementation',
    access: 'cloned',
  },
  'bwiki-standard-cards': {
    id: 'bwiki-standard-cards',
    title: '三国杀WIKI (BWIKI) — 标准包卡牌',
    url: 'https://wiki.biligame.com/sgs/%E6%A0%87%E5%87%86%E5%8C%85%E5%8D%A1%E7%89%8C',
    kind: 'secondary',
    access: 'cited-by-implementation',
    note: 'Officially-authorised community wiki; cited by wmzy deck.ts. Direct fetch blocked here.',
  },
  'guozhan-cards': {
    id: 'guozhan-cards',
    title: '三国杀国战 official site — 卡牌一览 (basic/trick/equipment card texts)',
    url: 'https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/jibenpai/2013/0130/149.html',
    kind: 'official',
    access: 'cited-by-implementation',
  },
  'yoka-cards': {
    id: 'yoka-cards',
    title: 'YOKA Games — 《三国杀》卡牌介绍',
    url: 'https://www.yokagames.com/sanguoshakapaijieshao/',
    kind: 'official',
    access: 'search-snippet',
  },
  'qsgs-repo': {
    id: 'qsgs-repo',
    title: 'Mogara/QSanguosha — C++/Qt implementation (GPL-3.0)',
    url: 'https://github.com/Mogara/QSanguosha',
    kind: 'implementation',
    access: 'cloned',
    note: 'GPL-3.0: read for behaviour cross-checks only, no code reused. Its "standard" package uses a revised card table (e.g. Slash ♠5, Peach ♦2) that differs from the 2008 boxed Standard deck.',
  },
  'kevinychen-repo': {
    id: 'kevinychen-repo',
    title: 'kevinychen/sanguosha — English online table (no rule enforcement)',
    url: 'https://github.com/kevinychen/sanguosha',
    kind: 'implementation',
    access: 'cloned',
    note: 'No LICENSE file: used only as a reference for established English translations; no code or text copied.',
  },
  'englishsanguosha-roles': {
    id: 'englishsanguosha-roles',
    title: 'English Sanguosha — Roles (cited in kevinychen/sanguosha roles.js)',
    url: 'http://www.englishsanguosha.com/rules/roles',
    kind: 'secondary',
    access: 'cited-by-implementation',
  },
  'sgs-english-walkthrough': {
    id: 'sgs-english-walkthrough',
    title: '三国杀! San Guo Sha Cardgame English Walkthrough (Liu Bei page)',
    url: 'http://sanguoshaenglish.blogspot.com/2010/07/liu-bei.html',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'bgg-lotk': {
    id: 'bgg-lotk',
    title: 'BoardGameGeek — Legends of the Three Kingdoms',
    url: 'https://boardgamegeek.com/boardgame/35188/legends-of-the-three-kingdoms',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'bgg-rules-intro': {
    id: 'bgg-rules-intro',
    title: 'BoardGameGeek thread — Introduction to the Rules of War of the Three Kingdoms: Standard Edition',
    url: 'https://boardgamegeek.com/thread/3580670/introduction-to-the-rules-of-war-of-the-three-king',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'wikipedia-lotk': {
    id: 'wikipedia-lotk',
    title: 'Wikipedia — Legends of the Three Kingdoms',
    url: 'https://en.wikipedia.org/wiki/Legends_of_the_Three_Kingdoms',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'zhwiki-standard': {
    id: 'zhwiki-standard',
    title: '维基百科 — 三国杀标准版',
    url: 'https://zh.wikipedia.org/zh-cn/%E4%B8%89%E5%9C%8B%E6%AE%BA%E6%A8%99%E6%BA%96%E7%89%88',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'zhwiki-sgs': {
    id: 'zhwiki-sgs',
    title: '维基百科 — 三国杀 (role table by player count)',
    url: 'https://zh.wikipedia.org/zh-hans/%E4%B8%89%E5%9B%BD%E6%9D%80',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'douban-faq': {
    id: 'douban-faq',
    title: '豆瓣 — 三国杀标准版FAQ－－基本牌、装备、锦囊篇',
    url: 'https://www.douban.com/group/topic/13117390/',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'faq-print': {
    id: 'faq-print',
    title: '三国杀游戏规则详细FAQ 打印版 (SMTH SanGuoSha board)',
    url: 'https://ks3-cn-beijing.ksyun.com/attachment/74ad98665ac744c138ba8c988d85d149',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'sgs-club-dying': {
    id: 'sgs-club-dying',
    title: '三国杀官方社区 — 对濒死角色求桃顺序 (official forum discussion)',
    url: 'https://club.sanguosha.com/thread-156910-1-1.html',
    kind: 'official',
    access: 'search-snippet',
  },
  'baidu-renegade': {
    id: 'baidu-renegade',
    title: '百度知道 — 反贼全部死亡只剩内奸时主公被闪电致死的胜负',
    url: 'https://zhidao.baidu.com/question/417041548.html',
    kind: 'secondary',
    access: 'search-snippet',
  },
  '9game-lord-select': {
    id: '9game-lord-select',
    title: '九游 — 三国杀游戏规则详细介绍 / 主公选武将规则',
    url: 'https://www.9game.cn/sanguosha/9525859.html',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'double-renegade': {
    id: 'double-renegade',
    title: '九游 — 新三国杀双内奸玩法攻略',
    url: 'https://www.9game.cn/news/5242421.html',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'baike-lightning': {
    id: 'baike-lightning',
    title: '百度百科 — 闪电 (三国杀)',
    url: 'https://baike.baidu.com/item/%E9%97%AA%E7%94%B5/624427',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'baike-peach': {
    id: 'baike-peach',
    title: '百度百科 — 桃 (三国杀游戏卡牌)',
    url: 'https://baike.baidu.com/item/%E6%A1%83/7272619',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'baike-doubleswords': {
    id: 'baike-doubleswords',
    title: '百度百科 — 雌雄双股剑',
    url: 'https://baike.baidu.com/item/%E9%9B%8C%E9%9B%84%E5%8F%8C%E8%82%A1%E5%89%91/4454767',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'baike-icesword': {
    id: 'baike-icesword',
    title: '百度百科 — 寒冰剑',
    url: 'https://wapbaike.baidu.com/item/%E5%AF%92%E5%86%B0%E5%89%91/8492001',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'sina-greendragon': {
    id: 'sina-greendragon',
    title: '新浪游戏 — 标准版装备牌•青龙偃月刀',
    url: 'http://games.sina.com.cn/o/z/sanguosha/2011-09-26/1624425908.shtml',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'sohu-basic-rules': {
    id: 'sohu-basic-rules',
    title: '搜狐 — 三国杀基本规则说明',
    url: 'https://www.sohu.com/a/297259228_120099898',
    kind: 'secondary',
    access: 'search-snippet',
  },
  'sgs-hero-1': hero(1, '刘备'),
  'sgs-hero-2': hero(2, '关羽'),
  'sgs-hero-3': hero(3, '张飞'),
  'sgs-hero-4': hero(4, '诸葛亮'),
  'sgs-hero-5': hero(5, '赵云'),
  'sgs-hero-6': hero(6, '马超'),
  'sgs-hero-7': hero(7, '黄月英'),
  'sgs-hero-8': hero(8, '孙权'),
  'sgs-hero-9': hero(9, '甘宁'),
  'sgs-hero-10': hero(10, '吕蒙'),
  'sgs-hero-11': hero(11, '黄盖'),
  'sgs-hero-12': hero(12, '周瑜'),
  'sgs-hero-13': hero(13, '大乔'),
  'sgs-hero-14': hero(14, '陆逊'),
  'sgs-hero-15': hero(15, '曹操'),
  'sgs-hero-16': hero(16, '司马懿'),
  'sgs-hero-17': hero(17, '夏侯惇'),
  'sgs-hero-18': hero(18, '张辽'),
  'sgs-hero-19': hero(19, '许褚'),
  'sgs-hero-20': hero(20, '郭嘉'),
  'sgs-hero-21': hero(21, '甄姬'),
  'sgs-hero-22': hero(22, '华佗'),
  'sgs-hero-23': hero(23, '吕布'),
  'sgs-hero-24': hero(24, '貂蝉'),
  'sgs-hero-25': hero(25, '孙尚香'),
};

export function sourcesFor(ids: string[]): SourceRef[] {
  return ids.map((id) => {
    const s = SOURCES[id];
    if (!s) throw new Error(`Unknown source id ${id}`);
    return s;
  });
}
