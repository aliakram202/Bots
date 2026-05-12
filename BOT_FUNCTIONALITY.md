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
- `SERPAPI_API_KEY`: optional primary provider for broad Google Events discovery.
- `TICKETMASTER_API_KEY`: optional secondary provider for ticketed event results.
- `TICKETMASTER_COUNTRY_CODE`: optional two-letter country filter, such as `IQ`, `JO`, `AE`, `GB`, or `US`.
- `GOOGLE_PLACES_API_KEY`: optional future provider for richer venue fallback.

Local `.env` is ignored by git and should hold real secrets.

## Commands

- `/start`: shows the welcome menu, command list, examples, and quick action buttons.
- `/help`: shows the same guide as `/start`.
- `/categories`: lists supported discovery categories.
- `/health`: reports whether the bot is running and whether live Ticketmaster events are enabled.

## Guided Assistant Flow

- `/start` resets the current chat's temporary flow and asks what the user is up to.
- The user can either share Telegram location or type a town name such as `Braunschweig`.
- After a town/location is known, the bot asks the user to choose a category.
- After a category is known, the bot asks how long the user is staying or searching.
- Supported free-text period examples include `today`, `tomorrow`, `this weekend`, `3 days`, `2 weeks`, and `1 month`.
- If the period is unclear, the bot defaults to the next `7 days` and says so.
- Conversation memory is in-process only; it resets when the local bot process restarts.

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

- `Braunschweig`
- `2 weeks`
- `free photography in Baghdad`
- `museums near me`
- `modern art exhibitions`
- `tickets for theatre`
- `عرض فني`

The intent detector supports basic typo aliases such as `museam` for `museum`.

## Location Search

- When a user sends their Telegram location, the bot stores it and asks for a category if one is not already selected.
- Once category and stay period are known, the bot first searches within `20km`.
- Results include nearby events and venues.
- The reply includes an `Expand to 50km` button.
- If nothing is found within `20km`, the bot still offers the `50km` expansion.
- The 50km expansion uses rounded callback coordinates, so no database is required.

## Event Data

The bot searches providers in this order:

- SerpApi Google Events when `SERPAPI_API_KEY` is set. This is the broadest source for city/category/date event discovery.
- Ticketmaster when `TICKETMASTER_API_KEY` is set. This is best for ticketed shows, theatre, concerts, and large venues.
- Local JSON fallback in `src/data/events.json`.
- Local venue fallback in `src/data/venues.json`.

If one live provider is disabled, fails, or returns no usable mapped events, the bot tries the next provider automatically.

## Venue Fallback

- If no dated events are found, the bot can show venues as `Places You Can Still Visit`.
- Venue fallback is intentionally separate from event results so the bot does not pretend a museum or gallery is a dated event.
- For typed towns, local venue fallback only shows venues that match the town text.
- For shared GPS location, venue fallback uses nearby local venues.

## Ticketmaster Integration

- Ticketmaster is a secondary provider.
- Nearby live searches use `geoPoint`, `radius`, and `unit=km`.
- Ticketmaster events are normalized into the same shape as local events.
- Live Ticketmaster searches can include city/town, category, and date-window filters.
- Events without coordinates are ignored because location search requires coordinates.

## SerpApi Integration

- SerpApi is the primary broad event discovery provider.
- It uses the Google Events engine with city/category/date queries.
- Results are normalized into the same internal event shape as Ticketmaster and local JSON.
- Simple date windows like today, tomorrow, week, and month are converted into supported Google Events date filters where possible.

## User Guidance Behavior

- The welcome message lists all commands and suggests the bot's main tools.
- Search result replies include a short tip suggesting location search, category buttons, or `/categories`.
- Result location links are compact: users see `Open in Maps`, not a long Google Maps URL.
- Event links are compact: users see `Tickets` or `Event page`, not long Ticketmaster URLs.
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
