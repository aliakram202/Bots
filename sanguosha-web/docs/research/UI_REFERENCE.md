# UI reference and design notes

## What was (and was not) studied

- **Official client screenshots/videos:** could **not** be opened from this build environment (network policy blocked sanguosha.com, YouTube/Bilibili-style video hosts and image CDNs). The layout below follows the information architecture described in the project brief — opponents around the top/sides, a central resolution area, and the local player's dashboard and hand at the bottom — which matches the long-standing San Guo Sha online/desktop convention. Nothing was traced or copied.
- **Open-source clients inspected (code + bundled demo GIFs):**
  - [wmzy/sanguosha](https://github.com/wmzy/sanguosha) (MIT): React table layout, prompt-driven response UX.
  - [kevinychen/sanguosha](https://github.com/kevinychen/sanguosha) (no license — reference only): in-game English translations accessible by hovering, which inspired our tooltip-everything approach.
  - [Mogara/QSanguosha](https://github.com/Mogara/QSanguosha) (GPL-3.0 — reference only): dashboard with equipment and judgment areas next to the hand; skill buttons on the dashboard.

## Our original interpretation

| Area | Decision |
|---|---|
| Visual language | Dark lacquer background, bronze lines, parchment cards, brush calligraphy (Google Font *Ma Shan Zheng*), serif display type (*Cormorant Garamond*), *Inter* for UI text. No official art, logos or frames. |
| Portraits | Generated SVG ink-wash: kingdom-tinted wash, the general's Chinese name in brush script, distant hills; per-general variation from a hash. Replaceable through `src/client/portraits.ts`. |
| Kingdoms | Colour **and** shape: Wei = square emblem (steel blue), Shu = circle (crimson), Wu = diamond (jade), Qun = hexagon (bronze-grey), always with the Chinese character. |
| Seats | Opponents on an ellipse starting at the lower right (next player) and going over the top to the lower left. Each panel: portrait, English + Chinese name, kingdom emblem, HP pips + numbers, hand-card count, equipment lines with suit/rank, judgment icons (乐/电), seat number, distance from you (`d2`), role badge (`?` until known), current-turn glow, waiting ring, disconnect warning. |
| Centre | Phase tracker, last card plays of the turn with captions ("Liu Bei used Slash → Lu Bu"), judgment card with its reason, Harvest cards, draw/discard piles with counts. |
| Dashboard | Portrait + name, role, big HP; skill buttons (tooltips with exact text, timing and official Chinese text; usable skills glow); equipment slots; judgment area; auto-use toggle. |
| Hand | Horizontal fan that overlaps as it grows; hover raises; selected cards rise and glow; playable cards outlined; unusable cards dimmed; clicking a dimmed card explains why. |
| Action bar | Above the hand: prompt in plain language, only the relevant buttons (Confirm / Cancel / Pass / End Play Phase / skill-specific), countdown bar. |
| Targeting | Valid targets glow blue; invalid seats dim and their tooltip explains why ("Out of attack range (distance 3, range 1)", "Target is protected by Kongcheng", "Select exactly two male characters"). |
| Feedback | Damage shake + red flash + floating −N; heal green flash +N; skill name toast; turn banner; dealt cards animate in; synthesized sound cues (toggle in the top bar). |
| Teaching | Rules drawer with search, card and general encyclopedias, every entry with clickable sources; response prompts spell out the situation ("Lu Bu used Slash against you. Wushuang requires 2 Dodges. Play Dodge (0/2) or Pass."). |
| Responsive | Desktop first (tested 1440×900, 1280×720); at ≤760 px the table becomes a vertical layout with a scrollable hand. |
