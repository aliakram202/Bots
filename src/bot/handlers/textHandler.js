const { config } = require("../../config");
const { detectIntent, parseQuery } = require("../../utils/intentDetector");
const searchService = require("../../utils/searchService");
const {
  escapeHtml,
  formatEventsGrouped,
  formatVenuesList
} = require("../../utils/formatter");
const { parseStayPeriod } = require("../../utils/stayPeriod");
const { clearState, getState, updateState } = require("../conversationState");
const { mainMenuKeyboard } = require("../keyboards");
const { DEFAULT_RADIUS_KM, replyNearbyResults } = require("./locationHandler");

const WELCOME_MSG = `👋 <b>Welcome to Salasil Bot</b>

🎨 I help you discover art, museums, photography, cinema, theatre, books, workshops, festivals, and free cultural events.

✨ <b>What are you up to today?</b>
Send me your Telegram location, or type a town name like <b>Braunschweig</b>.

🧭 Then I’ll ask you:
1. What category do you want?
2. How long are you staying?
3. I’ll show only matching events, with compact map and ticket links.

📍 Nearby searches start within <b>20km</b>, then you can expand to <b>50km</b>.

🛠️ <b>Commands</b>
/start - restart this guided flow
/help - show this guide
/categories - list discovery categories
/health - check bot and live API status

💬 <b>Try</b>
Braunschweig
free photography in Baghdad
museums near me
عرض فني`;

const CATEGORIES_MSG = `🎯 <b>Supported categories</b>
🏛️ Museums
🎨 Art and galleries
🎓 Workshops
🎉 Festivals
📷 Photography
🎬 Cinema and film
🎭 Theatre and performance
📚 Books and literature
💚 Free events
🎫 Ticketed events`;

const REPLY_OPTS = { parse_mode: "HTML" };
const RESULT_TIP = "\n\nTip: send a town name or location to narrow results, or use /categories.";

function replyOptions(extra = {}) {
  return { ...REPLY_OPTS, ...extra };
}

function getIncomingText(ctx) {
  if (ctx.match?.[1]) {
    return ctx.match[1];
  }
  if (ctx.callbackQuery?.data === "nearby:help") {
    return "nearby";
  }
  return ctx.message?.text || "";
}

function isCategoryCallback(ctx) {
  return Boolean(ctx.callbackQuery?.data?.startsWith("category:"));
}

async function replyWithMenu(ctx, message) {
  await ctx.reply(message, replyOptions(mainMenuKeyboard()));
}

function withResultTip(message) {
  return `${message}${RESULT_TIP}`;
}

async function sendSearchUpdate(ctx) {
  try {
    await ctx.sendChatAction("typing");
  } catch (_) {
    // Chat actions are helpful but not essential.
  }
}

function formatHealth() {
  return [
    "🩺 <b>Salasil health</b>",
    "Status: running",
    `Primary event API: ${config.serpApiKey ? "SerpApi enabled" : "SerpApi disabled"}`,
    `Secondary event API: ${config.ticketmasterApiKey ? "Ticketmaster enabled" : "Ticketmaster disabled"}`,
    `Country filter: ${escapeHtml(config.ticketmasterCountryCode || "none")}`
  ].join("\n");
}

function isLikelyTownName(text) {
  const value = String(text || "").trim();
  if (value.length < 2 || value.length > 60) return false;
  if (value.startsWith("/")) return false;
  if (detectIntent(value)) return false;
  if (/\d/.test(value)) return false;
  return /^[\p{L}][\p{L}\s'.-]*$/u.test(value);
}

function hasPlace(state) {
  return Boolean(state.location || state.townName);
}

function searchOptionsFromState(state) {
  const categoryOptions = {};
  if (state.category === "free") {
    categoryOptions.freeOnly = true;
  } else if (state.category === "tickets") {
    categoryOptions.ticketedOnly = true;
  } else {
    categoryOptions.category = state.category;
  }

  return {
    ...categoryOptions,
    dateWindow: state.dateWindow,
    locationName: state.townName,
    townName: state.townName
  };
}

async function askForPlace(ctx, category) {
  await ctx.reply(
    `Nice choice: <b>${escapeHtml(category)}</b>.\n\nWhere should I search? Send your Telegram location or type a town name like <b>Braunschweig</b>.`,
    REPLY_OPTS
  );
}

async function askForDuration(ctx, state) {
  const place = state.townName || "your shared location";
  await ctx.reply(
    `Great, I’ll search <b>${escapeHtml(state.category)}</b> around <b>${escapeHtml(place)}</b>.\n\nHow long are you staying or searching for?\n\nTry: <b>today</b>, <b>this weekend</b>, <b>3 days</b>, <b>2 weeks</b>, or <b>1 month</b>.`,
    REPLY_OPTS
  );
}

async function runGuidedSearch(ctx, state) {
  await sendSearchUpdate(ctx);

  if (state.location) {
    await replyNearbyResults(
      ctx,
      state.location.latitude,
      state.location.longitude,
      DEFAULT_RADIUS_KM,
      searchOptionsFromState(state)
    );
    return;
  }

  const options = searchOptionsFromState(state);
  let results;
  if (state.category === "free" || state.category === "tickets") {
    results = await searchService.searchEvents(state.townName || "event", options);
  } else {
    results = await searchService.searchByCategory(state.category, options);
  }
  const titleParts = [state.category, state.townName, state.dateWindow?.label].filter(Boolean);

  if (results.length === 0) {
    const venues = searchService.searchVenueFallback(options);
    if (venues.length > 0) {
      await ctx.reply(
        [
          `I couldn’t find dated <b>${escapeHtml(state.category)}</b> events for <b>${escapeHtml(state.townName)}</b> during <b>${escapeHtml(state.dateWindow?.label || "this period")}</b>.`,
          "",
          formatVenuesList(venues, "Places You Can Still Visit")
        ].join("\n"),
        replyOptions(mainMenuKeyboard())
      );
      return;
    }

    await replyWithMenu(
      ctx,
      `I couldn’t find <b>${escapeHtml(state.category)}</b> events for <b>${escapeHtml(state.townName)}</b> during <b>${escapeHtml(state.dateWindow?.label || "this period")}</b>.\n\nTry sharing your Telegram location for more accurate nearby results, or choose another category.`
    );
    return;
  }

  await ctx.reply(withResultTip(formatEventsGrouped(results, titleParts.join(" · "))), REPLY_OPTS);
}

async function handleCategoryChoice(ctx, category) {
  const state = updateState(ctx, {
    category,
    awaitingCategory: false
  });

  if (!hasPlace(state)) {
    await askForPlace(ctx, category);
    return;
  }

  if (!state.dateWindow) {
    updateState(ctx, { awaitingDuration: true });
    await askForDuration(ctx, state);
    return;
  }

  await runGuidedSearch(ctx, state);
}

async function handleDurationAnswer(ctx, text, state) {
  const dateWindow = parseStayPeriod(text);
  const next = updateState(ctx, {
    dateWindow,
    awaitingDuration: false
  });

  if (dateWindow.fallbackUsed) {
    await ctx.reply("I could not read that period clearly, so I’ll use the next 7 days.", REPLY_OPTS);
  }

  if (!next.category) {
    await replyWithMenu(ctx, "Got the time window. What kind of culture should I look for?");
    return;
  }

  if (!hasPlace(next)) {
    await askForPlace(ctx, next.category);
    return;
  }

  await runGuidedSearch(ctx, next);
}

async function handleDirectSearch(ctx, text, options) {
  const intent = options.category || detectIntent(text);

  if (intent === "museum") {
    return searchService.searchByCategory("museum", options).then(results => ctx.reply(withResultTip(formatEventsGrouped(results, "Museums")), REPLY_OPTS));
  }
  if (intent === "art") {
    return searchService.searchByCategory("art", options).then(results => ctx.reply(withResultTip(formatEventsGrouped(results, "Art Events")), REPLY_OPTS));
  }
  if (intent === "workshop") {
    return searchService.searchByCategory("workshop", options).then(results => ctx.reply(withResultTip(formatEventsGrouped(results, "Workshops")), REPLY_OPTS));
  }
  if (intent === "festival") {
    return searchService.searchByCategory("festival", options).then(results => ctx.reply(withResultTip(formatEventsGrouped(results, "Festivals")), REPLY_OPTS));
  }
  if (intent === "photography") {
    return searchService.searchByCategory("photography", options).then(results => ctx.reply(withResultTip(formatEventsGrouped(results, "Photography Events")), REPLY_OPTS));
  }
  if (intent === "cinema") {
    return searchService.searchByCategory("cinema", options).then(results => ctx.reply(withResultTip(formatEventsGrouped(results, "Cinema & Film")), REPLY_OPTS));
  }
  if (intent === "theatre") {
    return searchService.searchByCategory("theatre", options).then(results => ctx.reply(withResultTip(formatEventsGrouped(results, "Theatre & Performance")), REPLY_OPTS));
  }
  if (intent === "books") {
    return searchService.searchByCategory("books", options).then(results => ctx.reply(withResultTip(formatEventsGrouped(results, "Books & Literature")), REPLY_OPTS));
  }
  if (intent === "free") {
    const results = await searchService.searchFreeEvents();
    return ctx.reply(withResultTip(formatEventsGrouped(results, "Free Events")), REPLY_OPTS);
  }
  if (intent === "tickets") {
    const results = await searchService.searchTicketedEvents();
    return ctx.reply(withResultTip(formatEventsGrouped(results, "Ticketed Events")), REPLY_OPTS);
  }

  const results = await searchService.searchEvents(text, options);
  if (results.length > 0) {
    await ctx.reply(withResultTip(formatEventsGrouped(results, `Results for "${text}"`)), REPLY_OPTS);
    return;
  }

  const venues = searchService.searchVenueFallback(options);
  if (venues.length > 0) {
    await ctx.reply(
      [
        "I didn’t find dated events for that search yet.",
        "",
        formatVenuesList(venues, "Places You Can Still Visit")
      ].join("\n"),
      replyOptions(mainMenuKeyboard())
    );
    return;
  }

  await replyWithMenu(
    ctx,
    "I didn’t find a match for that yet.\n\nTry typing a town name like <b>Braunschweig</b>, sending your location, or choosing a category below."
  );
}

async function handleText(ctx) {
  const text = getIncomingText(ctx).trim();

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  if (text === "/start") {
    clearState(ctx);
    await replyWithMenu(ctx, WELCOME_MSG);
    return;
  }

  if (text === "/help" || text.toLowerCase() === "hello") {
    await replyWithMenu(ctx, WELCOME_MSG);
    return;
  }

  if (text === "/categories") {
    await replyWithMenu(ctx, CATEGORIES_MSG);
    return;
  }

  if (text === "/health") {
    await ctx.reply(formatHealth(), REPLY_OPTS);
    return;
  }

  if (text === "nearby") {
    await ctx.reply(
      "📍 Share your Telegram location and I’ll help you choose a category, ask how long you’re staying, then search nearby events within 20km first.",
      replyOptions({
        reply_markup: {
          keyboard: [[{ text: "Share my location", request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      })
    );
    return;
  }

  const state = getState(ctx);

  try {
    if (isCategoryCallback(ctx)) {
      await handleCategoryChoice(ctx, text);
      return;
    }

    if (state.awaitingDuration || (state.category && hasPlace(state) && !state.dateWindow)) {
      await handleDurationAnswer(ctx, text, state);
      return;
    }

    const parsed = parseQuery(text);
    if (parsed.category && hasPlace(state)) {
      const next = updateState(ctx, {
        category: parsed.category,
        awaitingCategory: false,
        awaitingDuration: true
      });
      await askForDuration(ctx, next);
      return;
    }

    if (isLikelyTownName(text)) {
      updateState(ctx, {
        townName: text,
        location: null,
        awaitingCategory: true,
        awaitingDuration: false,
        dateWindow: null
      });
      await replyWithMenu(
        ctx,
        `📍 Got it: <b>${escapeHtml(text)}</b>.\n\nWhat kind of culture are you looking for there?`
      );
      return;
    }

    const options = {
      freeOnly: parsed.freeOnly,
      ticketedOnly: parsed.ticketedOnly,
      locationName: parsed.locationName
    };

    await sendSearchUpdate(ctx);
    await handleDirectSearch(ctx, text, options);
  } catch (error) {
    console.error("Error handling text:", error);
    await ctx.reply("Something went wrong. Please try again.");
  }
}

module.exports = {
  CATEGORIES_MSG,
  RESULT_TIP,
  WELCOME_MSG,
  askForDuration,
  handleText,
  isLikelyTownName,
  withResultTip
};
