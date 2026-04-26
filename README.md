# 🎨 Zainab Art Assistant

A WhatsApp bot that helps discover art events, museums, and cultural activities with a deep focus on **Iraqi & Arab art**, while providing global coverage.

## Features

- 🌟 **Smart Intent Detection**: Understands natural language queries in English and Arabic
- 🎨 **Art Events Discovery**: Museums, galleries, exhibitions, workshops, festivals
- 📸 **Photography Events**: Photography exhibitions and festivals
- 🎬 **Cinema & Film**: Movies, documentaries, film festivals
- 🎭 **Theatre & Performance**: Stage performances, dance, ballet, opera
- 📚 **Books & Literature**: Author talks, book launches, poetry readings
- 📍 **Location-Based Search**: Find events near your location
- 🔍 **Free Events Finder**: Discover free art activities
- 🎫 **Ticket Information**: Direct links to event ticketing
- 🌍 **Global + Local**: International events with priority to Iraqi & Arab content

## Tech Stack

- **whatsapp-web.js**: WhatsApp Web automation
- **Node.js**: Runtime
- **Natural Language Processing**: Keyword-based intent detection (Arabic & English)
- **Haversine Formula**: Location-based proximity calculations

## Quick Start

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your preferences

### Running the Bot

```bash
npm start
```

On first run, a QR code will appear in the terminal. Scan it with WhatsApp to authenticate.

### Development

```bash
npm run dev
```

Uses `nodemon` for auto-reload on file changes.

## Project Structure

```
src/
├── index.js                    # Bot entry point
├── data/
│   ├── events.json            # Event database
│   └── venues.json            # Venue database
├── utils/
│   ├── searchService.js       # Core search logic
│   ├── intentDetector.js      # Natural language intent detection
│   └── formatter.js           # Message formatting
└── bot/
    └── handlers/
        ├── textHandler.js     # Text message processing
        ├── locationHandler.js # Location-based search
        ├── mediaHandler.js    # Media handling
        └── errorHandler.js    # Error handling
```

## How to Use

### Text Queries (Natural Language)

Send messages like:
- "Find me modern art exhibitions" → Art events
- "عرض فني" → Arabic queries work too
- "Museums near me" → With optional location
- "Free workshops" → Filter by free events
- "Photography festivals in 2026" → Specific categories

### Location Sharing

1. Send your location via WhatsApp
2. Bot will find nearby events within 100km
3. Results grouped by distance and region

### Intents Recognized

- **Art**: exhibitions, galleries, installations, paintings, sculptures
- **Museums**: cultural centers, heritage sites
- **Workshops**: hands-on classes, learning events
- **Festivals**: cultural celebrations, art fairs
- **Photography**: photo exhibitions, photography festivals
- **Cinema**: films, documentaries, festivals
- **Theatre**: stage performances, dance, opera
- **Books**: literature, author talks, readings
- **Free Events**: budget-friendly activities
- **Events with Tickets**: ticketed attractions

## Data Structure

### Events

```json
{
  "id": "evt-001",
  "name": "Baghdad Museum of Modern Art",
  "category": "museum",
  "location": { "lat": 33.3128, "lng": 44.3615 },
  "region": "arab",
  "description": "...",
  "opening_times": "09:00-17:00",
  "website": "...",
  "ticket_link": "...",
  "free": false
}
```

### Venues

```json
{
  "id": "ven-001",
  "name": "Al-Mutanabbi Street Cultural Center",
  "location": { "lat": 33.3218, "lng": 44.3638 },
  "region": "arab",
  "description": "...",
  "website": "..."
}
```

## Regions

- `arab`: Iraqi and Arab events (shown first in results)
- `international`: Global events (shown second)

## Cost Analysis

Assuming daily search (free tier):
- **WhatsApp Bot**: Free (uses WhatsApp Web, no API costs)
- **Hosting**: Free tier (Render, Railway) ~$0/month
- **Keep-Alive**: UptimeRobot free plan = $0/month
- **Total**: **$0/month** (entirely free tier)

## Troubleshooting

**Bot not responding?**
- Check `.wwebjs_cache/` folder exists
- Verify WhatsApp authentication completed (QR code scan)
- Check console for errors

**Missing events?**
- Add to `src/data/events.json`
- Use unique IDs
- Include all required fields

## Contributing

Feel free to add new events, venues, or improve detection logic!

## License

MIT

---

Made with ❤️ for Zainab
