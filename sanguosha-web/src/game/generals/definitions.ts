import type { Gender, Kingdom } from '../engine/types';

export interface GeneralDefinition {
  id: string;
  en: string;
  zh: string;
  title: string;
  kingdom: Kingdom;
  gender: Gender;
  hp: number;
  isLord: boolean;
  skills: string[];
  sources: string[];
}

const g = (
  id: string, en: string, zh: string, title: string, kingdom: Kingdom, gender: Gender, hp: number,
  skills: string[], hero: number, isLord = false,
): GeneralDefinition => ({ id, en, zh, title, kingdom, gender, hp, isLord, skills, sources: [`sgs-hero-${hero}`, 'zhwiki-standard', 'wmzy-repo'] });

// Standard Edition 25 generals. HP / gender / kingdom verified against the official
// sanguosha.com hero pages 1–25 (as quoted in wmzy/sanguosha research docs) and kevinychen/sanguosha data.
export const GENERALS: GeneralDefinition[] = [
  // Wei 魏
  g('caocao', 'Cao Cao', '曹操', 'Emperor Wu of Wei', 'wei', 'male', 4, ['jianxiong', 'hujia'], 15, true),
  g('simayi', 'Sima Yi', '司马懿', 'Ghost of the Wolf', 'wei', 'male', 3, ['fankui', 'guicai'], 16),
  g('xiahoudun', 'Xiahou Dun', '夏侯惇', 'One-eyed General', 'wei', 'male', 4, ['ganglie'], 17),
  g('zhangliao', 'Zhang Liao', '张辽', 'Fear of Xiaoyao Ford', 'wei', 'male', 4, ['tuxi'], 18),
  g('xuchu', 'Xu Chu', '许褚', 'Tiger Fool', 'wei', 'male', 4, ['luoyi'], 19),
  g('guojia', 'Guo Jia', '郭嘉', 'Early-dying Genius', 'wei', 'male', 3, ['tiandu', 'yiji'], 20),
  g('zhenji', 'Zhen Ji', '甄姬', 'Unfortunate Beauty', 'wei', 'female', 3, ['qingguo', 'luoshen'], 21),
  // Shu 蜀
  g('liubei', 'Liu Bei', '刘备', 'Ambitious Hero', 'shu', 'male', 4, ['rende', 'jijiang'], 1, true),
  g('guanyu', 'Guan Yu', '关羽', 'Beautiful Beard', 'shu', 'male', 4, ['wusheng'], 2),
  g('zhangfei', 'Zhang Fei', '张飞', 'Ten Thousand Men', 'shu', 'male', 4, ['paoxiao'], 3),
  g('zhugeliang', 'Zhuge Liang', '诸葛亮', 'Sleeping Dragon', 'shu', 'male', 3, ['guanxing', 'kongcheng'], 4),
  g('zhaoyun', 'Zhao Yun', '赵云', 'Lesser Dragon', 'shu', 'male', 4, ['longdan'], 5),
  g('machao', 'Ma Chao', '马超', 'Splendid Horseman', 'shu', 'male', 4, ['mashu', 'tieji'], 6),
  g('huangyueying', 'Huang Yueying', '黄月英', 'Wise Wife', 'shu', 'female', 3, ['jizhi', 'qicai'], 7),
  // Wu 吴
  g('sunquan', 'Sun Quan', '孙权', 'Young Wise Lord', 'wu', 'male', 4, ['zhiheng', 'jiuyuan'], 8, true),
  g('ganning', 'Gan Ning', '甘宁', 'Brocade Pirate', 'wu', 'male', 4, ['qixi'], 9),
  g('lumeng', 'Lu Meng', '吕蒙', 'White-robed Patriot', 'wu', 'male', 4, ['keji'], 10),
  g('huanggai', 'Huang Gai', '黄盖', 'Loyal Veteran', 'wu', 'male', 4, ['kurou'], 11),
  g('zhouyu', 'Zhou Yu', '周瑜', 'Grand Commander', 'wu', 'male', 3, ['yingzi', 'fanjian'], 12),
  g('daqiao', 'Da Qiao', '大乔', 'Elder Qiao', 'wu', 'female', 3, ['guose', 'liuli'], 13),
  g('luxun', 'Lu Xun', '陆逊', 'Young Scholar', 'wu', 'male', 3, ['qianxun', 'lianying'], 14),
  g('sunshangxiang', 'Sun Shangxiang', '孙尚香', 'Bow-waist Princess', 'wu', 'female', 3, ['jieyin', 'xiaoji'], 25),
  // Qun 群
  g('huatuo', 'Hua Tuo', '华佗', 'Divine Physician', 'qun', 'male', 3, ['jijiu', 'qingnang'], 22),
  g('lubu', 'Lu Bu', '吕布', 'Peerless Warrior', 'qun', 'male', 4, ['wushuang'], 23),
  g('diaochan', 'Diao Chan', '貂蝉', 'Peerless Beauty', 'qun', 'female', 3, ['lijian', 'biyue'], 24),
];

export const GENERALS_BY_ID: Record<string, GeneralDefinition> = Object.fromEntries(GENERALS.map((x) => [x.id, x]));

export function generalDef(id: string): GeneralDefinition {
  const d = GENERALS_BY_ID[id];
  if (!d) throw new Error(`Unknown general ${id}`);
  return d;
}

export const KINGDOM_INFO: Record<Kingdom, { en: string; zh: string; emblem: string }> = {
  wei: { en: 'Wei', zh: '魏', emblem: '魏' },
  shu: { en: 'Shu', zh: '蜀', emblem: '蜀' },
  wu: { en: 'Wu', zh: '吴', emblem: '吴' },
  qun: { en: 'Qun', zh: '群', emblem: '群' },
};
