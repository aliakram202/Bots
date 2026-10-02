# Edge cases and rulings

Each entry: the question, the ruling we implement, why, sources, and the test that pins it down.
Where sources disagree we choose the classic Standard/Identity interpretation and say so.

| # | Case | Ruling implemented | Basis / sources | Test |
|---|---|---|---|---|
| 1 | Lord dies with only a Renegade alive (all Rebels already dead) | Renegade wins | [百度知道](https://zhidao.baidu.com/question/417041548.html), [维基百科](https://zh.wikipedia.org/zh-hans/%E4%B8%89%E5%9B%BD%E6%9D%80) | core.test `Renegade end-game` |
| 2 | Lord dies while Rebels are all dead but a Loyalist (or a second Renegade) lives | Rebels win | same as above ("all other situations are a Rebel victory") | core.test `two Renegades alive…` |
| 3 | Dying at −1 HP | Needs two Peaches; the rescue loop continues until HP > 0 | [百度百科 桃](https://baike.baidu.com/item/%E6%A1%83/7272619) | core.test `HP below 0 needs several Peaches` |
| 4 | Rescue order | Current turn player first, then seat order; each player may use several Peaches; the dying player uses their own Peach when their turn in the order comes | [三国杀官方社区](https://club.sanguosha.com/thread-156910-1-1.html) | core.test `another player can save…` |
| 5 | Current player dies mid-turn (e.g. Kurou, Ganglie retaliation, Lightning) | Turn ends immediately; remaining resolution of the current card stops; cards in processing go to the discard pile | ⚠ Not verified against an official text (the FAQ PDF could not be opened from this environment): implemented from the commonly cited ruling that the current player's death ends their turn. Re-check [三国杀FAQ](https://ks3-cn-beijing.ksyun.com/attachment/74ad98665ac744c138ba8c988d85d149) | core.test `current player dying ends their turn` |
| 6 | After-damage skills when the damaged character dies | Not triggered | Standard timing: 濒死 resolves inside the damage step, "受到伤害后" only for survivors | fuzz + skills tests |
| 7 | Jianxiong vs Lightning | Cao Cao may obtain the Lightning card that struck him | Lightning is the card that caused the damage; it stays in the processing area during damage | skills.test `Jianxiong can take Lightning` |
| 8 | Negated Lightning | Moves to the next player without judging | [百度百科 闪电](https://baike.baidu.com/item/%E9%97%AA%E7%94%B5/624427) | core.test `Negated Lightning moves on` |
| 9 | Lightning moving to a player who already has a Lightning (EX deck has two) | Skips to the next player without one; if nobody qualifies it is discarded | consistent with "cannot have two of the same delayed trick" | engine `passLightning` |
| 10 | Liuli target restrictions | New target must be in Da Qiao's attack range, not the Slash user, not already a target, not protected (Kongcheng); range is recalculated without the card discarded as cost | Official text ([hero/13](https://www.sanguosha.com/hero/13)) says "攻击范围内的一名其他角色". ⚠ "Not the Slash user" and "not an existing target" are common rulings that were **not** verified against an official FAQ from this environment | skills.test `Liuli…` |
| 11 | Wusheng/Qixi/Guose using an equipped card | Allowed; the converted equipment's range/horse no longer counts for that use | general conversion rule | legal.ts `exclude` |
| 12 | Luoyi bonus | Applies to Slash/Duel damage where Xu Chu is the user and the source, during his own turn | official text "你本回合使用【杀】或【决斗】造成的伤害+1" ([sanguosha.com/hero/19](https://www.sanguosha.com/hero/19)) | skills.test `Luoyi…` |
| 13 | Wushuang in Duel | Opponent must play 2 Slashes each time; Lu Bu still plays 1 | official text ([hero/23](https://www.sanguosha.com/hero/23)) | skills.test `Wushuang: opponents need two Slashes` |
| 14 | Jiuyuan | +1 HP only for Peaches from *other Wu* characters (Sun Quan's own Peach: no bonus) | official text ([hero/8](https://www.sanguosha.com/hero/8)) | skills.test `Jiuyuan…` |
| 15 | Hujia/Jijiang helpers | Ask other Wei/Shu characters in seat order; the first who answers supplies the card (they may use their own conversions/armor). A helper cannot chain the Lord skill | official text ("视为由你使用或打出") | skills.test `Hujia`, `Jijiang` |
| 16 | Jijiang in the Play phase when nobody answers | The Slash is not used; Jijiang cannot be tried again this phase (prevents spam) | implementation choice; rule text is silent | — |
| 17 | Qingnang target | Any *injured* character including Hua Tuo | Official text "令一名角色回复1点体力" ([hero/22](https://www.sanguosha.com/hero/22)) does not mention injury; we only offer injured targets because healing a full-HP character has no effect (UX guard, documented deviation) | skills.test `Qingnang…` |
| 18 | Kongcheng after using the last card | Protection checked at targeting time only | official text | skills.test `Kongcheng` |
| 19 | Peach Garden on full-HP characters | Skipped (no Negate window) | modern ruling; no effect possible | core.test |
| 20 | Halberd extra targets | Only when the Slash's card(s) are all of your remaining hand cards | card text | core.test `Sky Piercing Halberd` |
| 21 | Frost Blade / Kylin Bow timing | Both are "when the Slash would deal damage": Frost Blade prevents it; Kylin Bow discards a horse and damage still happens | [百度百科 寒冰剑](https://wapbaike.baidu.com/item/%E5%AF%92%E5%86%B0%E5%89%91/8492001) | core.test |
| 22 | Rock Cleaving Axe cost | Any two cards from hand/equipment except the Axe itself | card text | core.test |
| 23 | Deck runs out | Discard pile is reshuffled; if both are empty when a card is needed, the game is a draw | common house ruling; no official Standard text found | engine `takeFromDeck` |
| 24 | Lord killing a Loyalist with Lightning | No penalty (no killer) | killer = damage source | — |
| 25 | Optional beneficial skills | Players can enable "auto-use helpful skills" (default on) for skills whose only effect is gaining cards/skipping discard (Yingzi, Jizhi, Lianying, Xiaoji, Biyue, Tiandu, Jianxiong, Luoshen, Guanxing, Tieji, Yin-Yang Swords, Keji, Yiji prompt). Turning it off asks every time | UX choice; all such skills remain optional | skills.test `declining an optional skill works` |

## Known information-leak trade-offs

- **Negate windows:** the server only waits for players who actually hold a Negate. Other players see "Waiting to see if anyone uses Negate…" without names, but the *existence* of a pause reveals that somebody holds a Negate. The official client pauses for everyone with a timer; we chose speed for friendly games. Configurable later.
- **Rescue prompts:** likewise, only players able to rescue (Peach, or Hua Tuo with a red card outside his turn) are asked.
