# Salasil Bot Functionality Reference

This file is the working reference for what the Telegram bot can do, how it is configured, and how to test it locally.

## Runtime

- The bot runs as a long-running Node process from your PC.
- Start it with `npm start`.
- Keep the terminal open and keep the PC awake for the bot to stay online.
- Stop it with `Ctrl+C`.
- The bot will go offline if the PC sleeps, shuts down, loses internet, or the terminal process closes.

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: required Telegram bot token from BotFather.
- `BOT_NAME`: optional display name used in docs and future copy.
- `DEBUG`: set to `true` for extra error logging.
- `TICKETMASTER_API_KEY`: optional Ticketmaster Developer Consumer Key for live event results.
- `TICKETMASTER_COUNTRY_CODE`: optional two-letter country filter, such as `IQ`, `JO`, `AE`, `GB`, or `US`.

Local `.env` is ignored by git and should hold real secrets.

## Commands

- `/start`: shows the welcome menu, command list, examples, and quick action buttons.
- `/help`: shows the same guide as `/start`.
- `/categories`: lists supported discovery categories.
- `/health`: reports whether the bot is running and whether live Ticketmaster events are enabled.

## Inline Buttons And Callbacks

- `category:museum`: searches museum events.
- `category:art`: searches art and gallery events.
- `category:photography`: searches photography events.
- `category:theatre`: searches theatre and performance events.
- `category:free`: searches free local fallback events.
- `nearby:help`: asks the user to share their Telegram location.
- `nearby:50:<lat>:<lng>`: expands a previous nearby search to 50km.

## Text Search

Users can send natural language in English or Arabic. Supported categories include:

- Museums
- Art and galleries
- Workshops
- Festivals
- Photography
- Cinema and film
- Theatre and performance
- Books and literature
- Free events
- Ticketed events

Example queries:

- `free photography in Baghdad`
- `museums near me`
- `modern art exhibitions`
- `tickets for theatre`
- `عرض فني`

The intent detector supports basic typo aliases such as `museam` for `museum`.

## Location Search

- When a user sends their Telegram location, the bot first searches within `20km`.
- Results include nearby events and venues.
- The reply includes an `Expand to 50km` button.
- If nothing is found within `20km`, the bot still offers the `50km` expansion.
- The 50km expansion uses rounded callback coordinates, so no database is required.

## Event Data

The bot has two event sources:

- Local JSON fallback in `src/data/events.json` and `src/data/venues.json`.
- Optional Ticketmaster live event search when `TICKETMASTER_API_KEY` is set.

If Ticketmaster is disabled, fails, or returns no usable mapped events, the bot falls back to local JSON data.

## Ticketmaster Integration

- The provider uses Ticketmaster Discovery API event search.
- Nearby live searches use `geoPoint`, `radius`, and `unit=km`.
- Ticketmaster events are normalized into the same shape as local events.
- Events without coordinates are ignored because location search requires coordinates.

## User Guidance Behavior

- The welcome message lists all commands and suggests the bot's main tools.
- Search result replies include a short tip suggesting location search, category buttons, or `/categories`.
- No-result replies suggest broader searches, quick buttons, `/categories`, or location sharing.
- Media replies explain that media analysis is not supported yet and redirect users toward text or location search.
- The bot uses typing chat actions during searches as lightweight status updates.

## Known Limits

- The bot does not store user profiles, favorites, subscriptions, or notification preferences yet.
- The bot does not send scheduled proactive notifications yet.
- Free-event filtering for live Ticketmaster results is limited because Ticketmaster does not always provide complete price/free metadata.
- Local fallback data is small and should be expanded or replaced with stronger cultural data sources over time.

## Verification

Run tests:

```bash
npm test
```

Check config loading:

```bash
node -e "require('./src/config'); console.log('config ok')"
```

Check bot construction without connecting to Telegram:

```bash
node -e "require('./src/index').createBot(); console.log('bot ok')"
```

## Future Improvements

- Add user subscriptions for category/location notifications.
- Add an admin workflow for submitting and moderating local cultural events.
- Add richer Arabic language handling.
- Add more Iraqi and Arab cultural event sources beyond Ticketmaster.
- Move to Railway, Render, or another host for 24/7 availability after local testing is stable.
