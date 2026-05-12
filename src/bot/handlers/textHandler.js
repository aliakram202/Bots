const { config } = require("../../config");
const { detectIntent, parseQuery } = require("../../utils/intentDetector");
const searchService = require("../../utils/searchService");
const {
  escapeHtml,
  formatEventsGrouped
} = require("../../utils/formatter");
const { mainMenuKeyboard } = require("../keyboards");

const WELCOME_MSG = `Hi! I'm <b>Salasil Bot</b>, an art and culture assistant with a deep love for Arabic and Iraqi art.

<b>Commands</b>
/start - open this menu
/help - show this guide
/categories - list discovery categories
/health - check bot and live API status

<b>Useful tools</b>
• Tap a category button for fast discovery.
• Send your Telegram location for events within 20km.
• Expand nearby search to 50km when you want more options.
• Ask for free events, tickets, museums, photography, theatre, books, cinema, or workshops.

<b>Try</b>
free photography in Baghdad
museums near me
عرض فني

I can use local data now, and Ticketmaster live events when the API key is configured.`;

const CATEGORIES_MSG = `Supported categories:
• Museums
• Art and galleries
• Workshops
• Festivals
• Photography
• Cinema and film
• Theatre and performance
• Books and literature
• Free events
• Ticketed events`;

const REPLY_OPTS = { parse_mode: "HTML" };
const RESULT_TIP = "\n\nTip: send your location for nearby events, tap a category button, or use /categories.";

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
    "<b>Salasil health</b>",
    "Status: running",
    `Live event API: ${config.ticketmasterApiKey ? "enabled" : "disabled, using local data"}`,
    `Country filter: ${escapeHtml(config.ticketmasterCountryCode || "none")}`
  ].join("\n");
}

async function handleText(ctx) {
  const text = getIncomingText(ctx);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  if (text === "/start" || text === "/help" || text.toLowerCase() === "hello") {
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
      "Share your Telegram location and I'll look for events and venues within 20km first. After that, you can expand the search to 50km.",
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

  const parsed = parseQuery(text);
  const intent = parsed.category || detectIntent(text);
  const options = {
    freeOnly: parsed.freeOnly,
    ticketedOnly: parsed.ticketedOnly,
    locationName: parsed.locationName
  };

  try {
    await sendSearchUpdate(ctx);

    if (intent === "museum") {
      const results = await searchService.searchByCategory("museum", options);
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Museums")), REPLY_OPTS);
    } else if (intent === "art") {
      const results = await searchService.searchByCategory("art", options);
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Art Events")), REPLY_OPTS);
    } else if (intent === "workshop") {
      const results = await searchService.searchByCategory("workshop", options);
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Workshops")), REPLY_OPTS);
    } else if (intent === "festival") {
      const results = await searchService.searchByCategory("festival", options);
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Festivals")), REPLY_OPTS);
    } else if (intent === "photography") {
      const results = await searchService.searchByCategory("photography", options);
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Photography Events")), REPLY_OPTS);
    } else if (intent === "cinema") {
      const results = await searchService.searchByCategory("cinema", options);
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Cinema & Film")), REPLY_OPTS);
    } else if (intent === "theatre") {
      const results = await searchService.searchByCategory("theatre", options);
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Theatre & Performance")), REPLY_OPTS);
    } else if (intent === "books") {
      const results = await searchService.searchByCategory("books", options);
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Books & Literature")), REPLY_OPTS);
    } else if (intent === "free") {
      const results = await searchService.searchFreeEvents();
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Free Events")), REPLY_OPTS);
    } else if (intent === "tickets") {
      const results = await searchService.searchTicketedEvents();
      await ctx.reply(withResultTip(formatEventsGrouped(results, "Ticketed Events")), REPLY_OPTS);
    } else {
      const results = await searchService.searchEvents(text, options);
      if (results.length > 0) {
        await ctx.reply(withResultTip(formatEventsGrouped(results, `Results for "${text}"`)), REPLY_OPTS);
      } else {
        await replyWithMenu(
          ctx,
          "I didn't find a match for that yet.\n\n" +
            "Try /categories, tap a quick button, send your location for nearby events, or search with broader words like art, museum, photography, theatre, workshop, books, cinema, free, or tickets."
        );
      }
    }
  } catch (error) {
    console.error("Error handling text:", error);
    await ctx.reply("Something went wrong. Please try again.");
  }
}

module.exports = {
  CATEGORIES_MSG,
  RESULT_TIP,
  WELCOME_MSG,
  handleText,
  withResultTip
};
