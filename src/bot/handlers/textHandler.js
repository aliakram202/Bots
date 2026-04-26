const { detectIntent } = require("../../utils/intentDetector");
const searchService = require("../../utils/searchService");
const {
  formatEventsGrouped,
  formatEventsList
} = require("../../utils/formatter");

const WELCOME_MSG = `👋 Hi! I'm *Salasil Bot* — with a deep love for *Arabic and Iraqi art* 🌟

I help you discover:
🎨 *Art & Galleries* - Exhibitions, museums, installations
📸 *Photography* - Photo exhibitions and festivals
🎬 *Cinema* - Films, documentaries, screenings
🎭 *Theatre* - Stage performances, dance, opera
📚 *Books* - Literature, author talks, poetry
🎉 *Events & Festivals* - Art fairs, celebrations
💚 *Free Events* - Budget-friendly activities

*How to use me:*
→ Ask naturally: "Show me modern art exhibitions"
→ Share your location to find *nearby* events
→ Mix Arabic & English freely! 🇮🇶🌍

What would you like to explore today?`;

const REPLY_OPTS = { parse_mode: "Markdown" };

async function handleText(ctx) {
  const text = ctx.message.text;

  if (text === "/start" || text.toLowerCase() === "hello") {
    await ctx.reply(WELCOME_MSG, REPLY_OPTS);
    return;
  }

  const intent = detectIntent(text);

  try {
    if (intent === "museum") {
      const results = searchService.searchByCategory("museum");
      await ctx.reply(formatEventsGrouped(results, "Museums"), REPLY_OPTS);
    } else if (intent === "art") {
      const results = searchService.searchByCategory("art");
      await ctx.reply(formatEventsGrouped(results, "Art Events"), REPLY_OPTS);
    } else if (intent === "workshop") {
      const results = searchService.searchByCategory("workshop");
      await ctx.reply(formatEventsGrouped(results, "Workshops"), REPLY_OPTS);
    } else if (intent === "festival") {
      const results = searchService.searchByCategory("festival");
      await ctx.reply(formatEventsGrouped(results, "Festivals"), REPLY_OPTS);
    } else if (intent === "photography") {
      const results = searchService.searchByCategory("photography");
      await ctx.reply(formatEventsGrouped(results, "Photography Events"), REPLY_OPTS);
    } else if (intent === "cinema") {
      const results = searchService.searchByCategory("cinema");
      await ctx.reply(formatEventsGrouped(results, "Cinema & Film"), REPLY_OPTS);
    } else if (intent === "theatre") {
      const results = searchService.searchByCategory("theatre");
      await ctx.reply(formatEventsGrouped(results, "Theatre & Performance"), REPLY_OPTS);
    } else if (intent === "books") {
      const results = searchService.searchByCategory("books");
      await ctx.reply(formatEventsGrouped(results, "Books & Literature"), REPLY_OPTS);
    } else if (intent === "free") {
      const results = searchService.searchFreeEvents();
      await ctx.reply(formatEventsGrouped(results, "Free Events"), REPLY_OPTS);
    } else if (intent === "tickets") {
      const results = searchService.searchTicketedEvents();
      await ctx.reply(formatEventsGrouped(results, "Ticketed Events"), REPLY_OPTS);
    } else {
      const results = searchService.searchEvents(text);
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
    await ctx.reply("❌ Something went wrong. Please try again.");
  }
}

module.exports = { handleText, WELCOME_MSG };
