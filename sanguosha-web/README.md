# Three Kingdoms Table

*A San Guo Sha (三国杀) compatible private game simulator.* Create a room, send friends the link, and play the classic **Standard Identity mode** (主公 / 忠臣 / 反贼 / 内奸) in the browser. No accounts needed.

> Fan-made for private play and study. Not affiliated with YOKA Games or the official San Guo Sha service. No official artwork, logos, music or sounds are included; portraits are generated ink-wash SVGs and sounds are synthesized in the browser.

## Quick start (local)

```bash
cd sanguosha-web
pnpm install
pnpm dev            # server on :8787 (tsx watch) + Vite client on :5173
# open http://localhost:5173
```

Production-style run (what you deploy):

```bash
pnpm build          # → dist/client (static) + dist/server/main.js
pnpm start          # http://localhost:8787  (PORT env var to change)
```

Developer debug rooms (scenario loader, act-as-any-seat, server-state inspector, give/equip/judge/HP tools):

```bash
ENABLE_DEBUG=1 pnpm start   # then tick "Developer debug room" on the home page
```

Debug tools are **off** unless the server is started with `ENABLE_DEBUG=1`, and even then they only exist in rooms created as debug rooms, for that room's host.

## How to play with friends

1. Open the site → enter your name → **Create Room**.
2. Copy the invite link (`/room/ABC123`) and send it to friends; they enter a name and join. Up to 8 players; add bots to fill seats.
3. Everyone clicks **I'm ready**; the host adjusts settings (role variant, EX cards, timers, number of generals offered) and clicks **Start**.
4. The Lord picks a general first (shown to all), then everyone picks privately. Play proceeds automatically; the server enforces every rule.
5. Closing the tab is fine: reopening the link reconnects you to the same seat (a private token is kept in your browser). Disconnected players' prompts time out after 20 s so the table never stalls.
6. At the end all roles are revealed with the reason for the win; the host can start a rematch.

Click **Rules** at any time for the rulebook, a searchable card and general encyclopedia, and links to sources.

## Tests

```bash
pnpm typecheck
pnpm lint
pnpm test          # Vitest: deck, roles, victory, distance, turn flow, every card, every skill,
                   #         fuzzed full matches with legal-only bots, hidden-info views, rooms/persistence
pnpm build && pnpm e2e   # Playwright: multi-context lobby/game, reconnect, rules drawer,
                          #             scripted Slash→dying→death game, and the security test
```

The **security test** (`e2e/security.spec.ts`) opens Player A and Player B in separate browser contexts, records every WebSocket frame A receives, and asserts that none of them contains B's hand, B's role (unless B is the public Lord) or any of B's private log lines.

## Deployment

The app is **one persistent Node process** serving HTTP, the WebSocket endpoint (`/ws`) and the static client on the same port. Don't use a serverless/edge-only host: games live in server memory and need long-lived WebSockets.

**Recommended: Fly.io** (persistent VM, native WebSockets, HTTPS, small volume for room snapshots):

```bash
cd sanguosha-web
fly launch --no-deploy --copy-config      # accept the generated app name or edit fly.toml
fly volumes create rooms --size 1
fly deploy
# → https://<your-app>.fly.dev  — send friends https://<your-app>.fly.dev/room/CODE
```

Keep **one machine** (`min_machines_running = 1`, auto-stop off): rooms are held in that process.

Any Docker host works too (Railway, Render web service, a VPS):

```bash
docker build -t three-kingdoms-table .
docker run -p 8080:8080 -v tkt-data:/data three-kingdoms-table
# or: docker compose up -d
```

Behind a reverse proxy, forward WebSocket upgrades for `/ws` (nginx: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | `8787` (`8080` in Docker) | HTTP + WebSocket port |
| `DATA_DIR` | `./data/rooms` | Room snapshots (JSON). Games are rebuilt by deterministic replay on restart |
| `STORE` | `file` | `file` or `memory` |
| `ENABLE_DEBUG` | off | `1` enables debug rooms. Never enable on a public server |
| `BOT_DELAY_MS` | `900` | Bot "thinking" delay |

Health: `GET /health` → `{ ok, uptimeSec, rooms, websocket: { path, clients } }`. The server pings every WebSocket every 25 s and drops dead connections; clients reconnect with exponential backoff and receive a full state resync.

## Architecture

```
src/
  game/                 pure rules engine (no React, no network, deterministic)
    engine/             types, Game (state + dispatch), generator flows, legality, views, bot, debug, rng
    cards/              card definitions (data) + the exact 108-card Standard/EX deck table
    generals/           25 Standard generals (data)
    skills/             skill text (data) + behaviour (hook tables, active skills, equipment effects)
    rules/              roles/victory, distance/range/protection
    content/            source registry + rulebook text
    tests/              Vitest suites
  server/               Hono HTTP API, ws WebSocket server, rooms, timers, bots, persistence
  shared/protocol.ts    zod-validated client→server messages, server→client message types
  client/               React + Vite UI
e2e/                    Playwright tests
docs/                   research (rules, cards, generals, skills, edge cases, UI) + SOURCES.md
```

Key decisions:

- **One deterministic generator per game.** The whole match is a TypeScript generator that `yield`s *Decisions* (play, respond, negate, choose cards/players/options, Guanxing, Yiji, Harvest, choose general) and receives validated *Answers*. Nested flows (`useCard → slash → requestCard → judge → damage → dying → death`) compose with `yield*`, so interrupts (Negate chains, Liuli redirects, Guicai, Hujia/Jijiang helpers, rescue loops) need no UI-specific code.
- **Server-authoritative.** Clients send answers only. `legal.ts` computes legal options (with human-readable reasons for illegal targets) and re-validates every answer. `view.ts` builds a sanitized per-player view; other players' hands, roles, private choices and the deck order never leave the server.
- **Replay = persistence.** A game is `config (incl. secret seed) + command list`. Snapshots store just that; restarts rebuild games by replaying. The same log gives deterministic tests, reconnect-safe state and a future replay viewer. Production seeds come from `crypto.getRandomValues` and never leave the server.
- **Data-driven content.** Cards, generals and skill texts are plain data; behaviour lives in hook tables keyed by skill/equipment id (`onStartPhase`, `onDrawPhase`, `beforeDiscardPhase`, `onEndPhase`, `afterDamaged`, `beforeJudgmentEffect`, `afterJudgment`, `onUseInstantTrick`, `onBecomeSlashTarget`, `afterSlashTarget`, `onSlashDodged`, `beforeSlashDamage`, `onLoseCards`) plus an `ACTIVE_SKILLS` table. Expansions (Military Struggle, Wind/Fire/Forest/Mountain…) add data, hooks and card effects without touching the core loop. See *Next steps* below.
- **GameStore abstraction.** `RoomStore` (`FileRoomStore`, `MemoryRoomStore`) can be swapped for Redis/PostgreSQL.

## Research & sources

- Rules: [`docs/research/RULES.md`](docs/research/RULES.md)
- Cards: [`docs/research/CARDS.md`](docs/research/CARDS.md) · Generals: [`docs/research/GENERALS.md`](docs/research/GENERALS.md) · Skills: [`docs/research/SKILLS.md`](docs/research/SKILLS.md)
- Edge cases & rulings: [`docs/research/EDGE_CASES.md`](docs/research/EDGE_CASES.md) · UI notes: [`docs/research/UI_REFERENCE.md`](docs/research/UI_REFERENCE.md)
- All sources with links: [`docs/SOURCES.md`](docs/SOURCES.md) (`pnpm docs:gen` regenerates the data-derived docs)

## Credits & licences

San Guo Sha was created by KayaK (Huang Kai) and is published by YOKA Games. This project is an independent fan implementation. Reference implementations consulted: [wmzy/sanguosha](https://github.com/wmzy/sanguosha) (MIT), [Mogara/QSanguosha](https://github.com/Mogara/QSanguosha) (GPL-3.0, read only) and [kevinychen/sanguosha](https://github.com/kevinychen/sanguosha) (translation reference only). No code was copied from them.
