// Text message handler

const { detectIntent } = require("../../utils/intentDetector");
const searchService = require("../../utils/searchService");
const {
  formatEventsGrouped,
  formatEventsList
} = require("../../utils/formatter");

const WELCOME_MSG = `👋 Hi! I'm your art assistant — with a deep love for *Arabic and Iraqi art* 🌟

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

/**
 * Handles text messages from users
 */
async function handleText(msg, client) {
  const text = msg.body;

  // Welcome message on /start
  if (text === "/start" || text.toLowerCase() === "hello") {
    await msg.reply(WELCOME_MSG);
    return;
  }

  // Detect user intent
  const intent = detectIntent(text);

  try {
    // Intent-based routing
    if (intent === "museum") {
      const results = searchService.searchByCategory("museum");
      const response = formatEventsGrouped(results, "Museums");
      await msg.reply(response);
    }
    else if (intent === "art") {
      const results = searchService.searchByCategory("art");
      const response = formatEventsGrouped(results, "Art Events");
      await msg.reply(response);
    }
    else if (intent === "workshop") {
      const results = searchService.searchByCategory("workshop");
      const response = formatEventsGrouped(results, "Workshops");
      await msg.reply(response);
    }
    else if (intent === "festival") {
      const results = searchService.searchByCategory("festival");
      const response = formatEventsGrouped(results, "Festivals");
      await msg.reply(response);
    }
    else if (intent === "photography") {
      const results = searchService.searchByCategory("photography");
      const response = formatEventsGrouped(results, "Photography Events");
      await msg.reply(response);
    }
    else if (intent === "cinema") {
      const results = searchService.searchByCategory("cinema");
      const response = formatEventsGrouped(results, "Cinema & Film");
      await msg.reply(response);
    }
    else if (intent === "theatre") {
      const results = searchService.searchByCategory("theatre");
      const response = formatEventsGrouped(results, "Theatre & Performance");
      await msg.reply(response);
    }
    else if (intent === "books") {
      const results = searchService.searchByCategory("books");
      const response = formatEventsGrouped(results, "Books & Literature");
      await msg.reply(response);
    }
    else if (intent === "free") {
      const results = searchService.searchFreeEvents();
      const response = formatEventsGrouped(results, "Free Events");
      await msg.reply(response);
    }
    else if (intent === "tickets") {
      const results = searchService.searchTicketedEvents();
      const response = formatEventsGrouped(results, "Ticketed Events");
      await msg.reply(response);
    }
    else {
      // Generic text search
      const results = searchService.searchEvents(text);
      if (results.length > 0) {
        const response = formatEventsGrouped(results, `Results for "${text}"`);
        await msg.reply(response);
      } else {
        await msg.reply(
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
    await msg.reply("❌ Something went wrong. Please try again.");
  }
}

module.exports = { handleText, WELCOME_MSG };
