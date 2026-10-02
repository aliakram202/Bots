# Rules — Classic Identity Mode (身份局), Standard Edition (标准版)

This is the ruleset the engine implements. Every section lists the sources it was taken from; full source metadata is in [../SOURCES.md](../SOURCES.md). Card, general and skill details are in [CARDS.md](CARDS.md), [GENERALS.md](GENERALS.md) and [SKILLS.md](SKILLS.md). Rulings on ambiguous cases are in [EDGE_CASES.md](EDGE_CASES.md).

> **Research access caveat.** The build environment's network policy blocked direct page fetches from BoardGameGeek, Wikipedia, BWIKI, sanguosha.com and the English Walkthrough blog. Those pages were consulted via search-engine extracts, and the official sanguosha.com hero texts were read from the verbatim quotes in the cloned wmzy/sanguosha research notes. Links are preserved so every point can be re-checked.

## 1. Players and roles

| Players | Lord 主公 | Loyalist 忠臣 | Rebel 反贼 | Renegade 内奸 | Alternative |
|---|---|---|---|---|---|
| 4 | 1 | 1 | 1 | 1 | — |
| 5 | 1 | 1 | 2 | 1 | — |
| 6 | 1 | 1 | 3 | 1 | 1/1/2/2 ("double Renegade") |
| 7 | 1 | 2 | 3 | 1 | — |
| 8 | 1 | 2 | 4 | 1 | 1/2/3/2 ("double Renegade") |

- Default: the single-Renegade column. The host may pick the double-Renegade variant for 6 or 8 players.
- The Lord reveals their role at once; all other roles stay secret until that player dies or the game ends.
- 2–3 player counts are allowed for casual/testing play (2: Lord vs Rebel; 3: Lord, Rebel, Renegade). They are not part of the classic rules.

Sources: [维基百科 三国杀](https://zh.wikipedia.org/zh-hans/%E4%B8%89%E5%9B%BD%E6%9D%80) (secondary), [wmzy research 基础规则.md](https://github.com/wmzy/sanguosha) (implementation), [九游 双内奸](https://www.9game.cn/news/5242421.html) (secondary), [Wikipedia — Legends of the Three Kingdoms](https://en.wikipedia.org/wiki/Legends_of_the_Three_Kingdoms) (secondary).

**Discrepancy:** [English Sanguosha roles](http://www.englishsanguosha.com/rules/roles) (as cited in kevinychen/sanguosha) lists 4 players as 1 King / 2 Rebels / 1 Spy and 9–10 player variants. We follow the Chinese Standard table above for 4 players.

## 2. Setup

1. Roles are dealt randomly; the Lord is revealed.
2. The Lord picks a general from **Cao Cao, Liu Bei, Sun Quan + 2 random generals** and reveals it.
3. Every other player privately picks from **3 random generals** (host-configurable 2–5).
4. With **5+ players the Lord gets +1 max HP** (not in 4-player games).
5. Everyone draws **4 cards**; the Lord takes the first turn; play proceeds in seat order.

Sources: [九游 主公选武将规则](https://www.9game.cn/sanguosha/9525859.html), [维基百科 三国杀](https://zh.wikipedia.org/zh-hans/%E4%B8%89%E5%9B%BD%E6%9D%80), [搜狐 基本规则](https://www.sohu.com/a/297259228_120099898) (all secondary).

## 3. Turn structure

Start (准备) → Judgment (判定) → Draw (摸牌, 2 cards) → Play (出牌) → Discard (弃牌, down to current HP) → End (结束).

- Skipped phases (Indulgence → Play; Keji → Discard) are logged and their triggers do not happen.
- One Slash per Play phase unless modified (Zhuge Crossbow, Paoxiao). Green Dragon / Borrowed Sword Slashes do not count.
- Hand limit = current HP (never below 0).

Sources: [wmzy research](https://github.com/wmzy/sanguosha) (implementation), [BGG rules intro](https://boardgamegeek.com/thread/3580670/introduction-to-the-rules-of-war-of-the-three-king) (secondary), [搜狐 基本规则](https://www.sohu.com/a/297259228_120099898).

## 4. Card handling vocabulary

The engine distinguishes **use** (使用 — Slash, Peach, Dodge vs. Slash, tricks), **play** (打出 — Slash in Duel/Barbarians, Dodge vs. Hail of Arrows is treated as use), **discard** (弃置), **lose** (失去 — any card leaving hand/equipment; triggers Lianying/Xiaoji), **obtain** (获得), and **give/transfer** (交给). Recast (重铸) is not in the Standard set. Sources: [wmzy research 使用和打出.md](https://github.com/wmzy/sanguosha).

## 5. Distance and attack range

- Seat distance = steps to the target around the table counting only living players, the shorter way.
- Target's +1 horse: +1. Source's −1 horse: −1. Mashu: −1. Minimum 1.
- Attack range = weapon range (1 without weapon). Slash requires distance ≤ attack range.
- Steal requires **distance** ≤ 1 (not attack range); Qicai removes trick distance limits.
- When the card being used is itself the equipment that provides the range/horse (e.g. Guan Yu using his red weapon as a Slash), that equipment's effect is ignored for that check.

Sources: [国战官网 卡牌一览](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/jibenpai/2013/0130/149.html) (official), [wmzy research](https://github.com/wmzy/sanguosha).

## 6. Responses, Negate and resolution

- A **Slash** asks the target for a Dodge (two with Wushuang). **Duel** alternates Slashes starting with the target. **Barbarian Invasion** asks each other player for a Slash, **Hail of Arrows** for a Dodge, in seat order from the user.
- **Negate** may be used by anyone whenever an instant trick is about to take effect on a target (each target of an AoE separately) or when a delayed trick resolves. Negate can be Negated, alternating the outcome.
- Lijian's Duel cannot be Negated (skill text).

Sources: [豆瓣 标准版FAQ](https://www.douban.com/group/topic/13117390/) (secondary), [国战官网 卡牌一览](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/jibenpai/2013/0130/149.html) (official).

## 7. Judgment

Reveal the top card → "before it takes effect" window (Guicai, in seat order from the current player) → the result is evaluated → "after it takes effect" (Tiandu) → the card goes to the discard pile unless obtained (Luoshen black cards, Tiandu, Jianxiong on Lightning damage).

- Indulgence: unless ♥, skip Play phase.
- Lightning: ♠2–♠9 → 3 thunder damage with no source; else move to the next living player without a Lightning.
- Eight Trigrams: red → counts as a Dodge (not available against Qinggang Sword).
- Delayed tricks resolve most-recently-placed first.

Sources: [百度百科 闪电](https://baike.baidu.com/item/%E9%97%AA%E7%94%B5/624427), [三国杀FAQ 打印版](https://ks3-cn-beijing.ksyun.com/attachment/74ad98665ac744c138ba8c988d85d149) (secondary).

## 8. Damage, dying and death

- HP ≤ 0 → **dying**. Rescue order starts with the **current turn player** and proceeds in seat order; each may use Peaches until the dying character is above 0 HP (at −1 HP two Peaches are needed). The dying character can use their own Peach when their place in the order comes.
- Unrescued → death: role revealed, all cards discarded, victory checked immediately.
- After-damage triggers (Jianxiong, Fankui, Ganglie, Yiji) only happen if the damaged character survives the dying step.
- **Rewards/penalties:** killing a Rebel → the killer draws 3; the Lord killing a Loyalist → the Lord discards all hand and equipment cards. No killer (Lightning, Kurou) → no reward.
- If the current player dies, their turn ends immediately and all ongoing resolution stops.

Sources: [三国杀官方社区 求桃顺序](https://club.sanguosha.com/thread-156910-1-1.html) (official forum), [百度百科 桃](https://baike.baidu.com/item/%E6%A1%83/7272619), [Wikipedia — LotK](https://en.wikipedia.org/wiki/Legends_of_the_Three_Kingdoms), [BGG — LotK](https://boardgamegeek.com/boardgame/35188/legends-of-the-three-kingdoms).

## 9. Victory

- **Lord + Loyalists:** all Rebels and Renegades dead while the Lord lives.
- **Rebels:** the Lord dies — unless the only surviving character is a Renegade.
- **Renegade:** the Lord dies while the Renegade is the sole survivor. With two Renegades alive when the Lord dies, the Rebels win.
- If the deck and discard pile are both empty when a card must be drawn, the game ends in a draw.

Sources: [百度知道 内奸胜利裁定](https://zhidao.baidu.com/question/417041548.html), [维基百科 三国杀](https://zh.wikipedia.org/zh-hans/%E4%B8%89%E5%9B%BD%E6%9D%80), [Wikipedia — LotK](https://en.wikipedia.org/wiki/Legends_of_the_Three_Kingdoms).
