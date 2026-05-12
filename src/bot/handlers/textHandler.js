const { config } = require("../../config");
const { detectIntent, parseQuery } = require("../../utils/intentDetector");
const searchService = require("../../utils/searchService");
const {
  escapeHtml,
  formatEventsGrouped
} = require("../../utils/formatter");
const { mainMenuKeyboard } = require("../keyboards");

const WELCOME_MSG = `Hi! I'm <b>Salasil Bot</b>, an art and culture assistant with a deep love for Arabic and Iraqi art.

I help you discover:
🎨 <b>Art &amp; Galleries</b> - exhibitions, museums, installations
📸 <b>Photography</b> - photo exhibitions and festivals
🎬 <b>Cinema</b> - films, documentaries, screenings
🎭 <b>Theatre</b> - stage performances, dance, opera
📚 <b>Books</b> - literature, author talks, poetry
💚 <b>Free Events</b> - budget-friendly activities

Ask naturally, try a button below, or share your location to find nearby events. Arabic and English both work.`;

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
      "Share your Telegram location and I'll look for nearby events and venues within 100km.",
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
    if (intent === "museum") {
      const results = await searchService.searchByCategory("museum", options);
      await ctx.reply(formatEventsGrouped(results, "Museums"), REPLY_OPTS);
    } else if (intent === "art") {
      const results = await searchService.searchByCategory("art", options);
      await ctx.reply(formatEventsGrouped(results, "Art Events"), REPLY_OPTS);
    } else if (intent === "workshop") {
      const results = await searchService.searchByCategory("workshop", options);
      await ctx.reply(formatEventsGrouped(results, "Workshops"), REPLY_OPTS);
    } else if (intent === "festival") {
      const results = await searchService.searchByCategory("festival", options);
      await ctx.reply(formatEventsGrouped(results, "Festivals"), REPLY_OPTS);
    } else if (intent === "photography") {
      const results = await searchService.searchByCategory("photography", options);
      await ctx.reply(formatEventsGrouped(results, "Photography Events"), REPLY_OPTS);
    } else if (intent === "cinema") {
      const results = await searchService.searchByCategory("cinema", options);
      await ctx.reply(formatEventsGrouped(results, "Cinema & Film"), REPLY_OPTS);
    } else if (intent === "theatre") {
      const results = await searchService.searchByCategory("theatre", options);
      await ctx.reply(formatEventsGrouped(results, "Theatre & Performance"), REPLY_OPTS);
    } else if (intent === "books") {
      const results = await searchService.searchByCategory("books", options);
      await ctx.reply(formatEventsGrouped(results, "Books & Literature"), REPLY_OPTS);
    } else if (intent === "free") {
      const results = await searchService.searchFreeEvents();
      await ctx.reply(formatEventsGrouped(results, "Free Events"), REPLY_OPTS);
    } else if (intent === "tickets") {
      const results = await searchService.searchTicketedEvents();
      await ctx.reply(formatEventsGrouped(results, "Ticketed Events"), REPLY_OPTS);
    } else {
      const results = await searchService.searchEvents(text, options);
      if (results.length > 0) {
        await ctx.reply(formatEventsGrouped(results, `Results for "${text}"`), REPLY_OPTS);
      } else {
        await ctx.reply(
          "🤔 I didn't understand that query. Try asking about:\n" +
          "• Art, museums, galleries\n" +
          "• Photography, cinema, theatre\n" +
          "• Free events, workshops\n" +
          "• Books & literature\n\n" +
          "Or share your location to find nearby events!"
        );
      }
    }
  } catch (error) {
    console.error("Error handling text:", error);
    await ctx.reply("Something went wrong. Please try again.");
  }
}

module.exports = { handleText, WELCOME_MSG };
