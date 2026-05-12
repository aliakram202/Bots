# Salasil Bot

Salasil Bot is a Telegram assistant for discovering art, culture, museums, exhibitions, workshops, cinema, theatre, photography, books, and festivals, with Iraqi and Arab results prioritized when available.

The bot works immediately from the local JSON dataset. If you add a Ticketmaster API key, it can also pull live event results and fall back to local data when the API is unavailable or empty.

## Features

- Telegram bot powered by Telegraf
- English and Arabic keyword intent detection
- Compound queries such as `free photography in Baghdad`
- Location sharing for nearby events and venues within 20km, with a 50km expansion option
- Inline category buttons for quick discovery
- Optional Ticketmaster live event search
- Safe Telegram HTML formatting for user and provider content
- Local fallback data in `src/data/events.json` and `src/data/venues.json`

## Quick Start

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` and set your Telegram token:

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
BOT_NAME=Salasil Bot
DEBUG=false
```

Start the bot:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Full Functionality Reference

See [BOT_FUNCTIONALITY.md](BOT_FUNCTIONALITY.md) for the full command list, callbacks, location flow, env vars, and future roadmap.

## Optional Live Events

The bot runs without external event APIs. To enable live Ticketmaster results, add this to `.env`:

```bash
TICKETMASTER_API_KEY=your_ticketmaster_key_here
TICKETMASTER_COUNTRY_CODE=IQ
```

Use the Ticketmaster Developer `Consumer Key` as `TICKETMASTER_API_KEY`. `TICKETMASTER_COUNTRY_CODE` is optional; use a two-letter country code like `IQ`, `JO`, `AE`, `GB`, or `US` to bias results.

## Bot Commands

- `/start` - show the main menu
- `/help` - show usage help
- `/categories` - list supported categories
- `/health` - confirm the bot is running and show live API status

You can also send natural messages like:

- `modern art exhibitions`
- `free photography in Baghdad`
- `museam near me`
- `عرض فني`
- `workshops`

To search nearby events, send your Telegram location. The bot searches within 20km first and then offers to expand to 50km.

## Project Structure

```text
src/
├── index.js                    # Bot startup and route registration
├── config.js                   # Environment validation
├── data/                       # Local fallback events and venues
├── providers/                  # Optional external event providers
├── utils/                      # Intent detection, search, formatting
└── bot/
    ├── keyboards.js            # Telegram inline/reply keyboards
    └── handlers/               # Text, location, media, and error handlers
```

## Testing

Run the test suite:

```bash
npm test
```

Smoke-check config loading:

```bash
node -e "require('./src/config'); console.log('config ok')"
```

Smoke-check bot construction without connecting to Telegram:

```bash
node -e "require('./src/index').createBot(); console.log('bot ok')"
```

## Data

Local events use this shape:

```json
{
  "id": "evt-001",
  "name": "Baghdad Museum of Modern Art",
  "category": "museum",
  "location": { "lat": 33.3128, "lng": 44.3615 },
  "region": "arab",
  "description": "Contemporary art collection focusing on Iraqi artists",
  "opening_times": "09:00-17:00",
  "website": "https://example.com",
  "ticket_link": "https://example.com/tickets",
  "free": false
}
```

Use `region: "arab"` for Iraqi and Arab content that should be shown first, and `region: "international"` for global results.
