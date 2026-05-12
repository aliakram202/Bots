const searchService = require("../../utils/searchService");
const { formatEventsList, formatVenuesList } = require("../../utils/formatter");

const REPLY_OPTS = { parse_mode: "HTML" };

async function handleLocation(ctx) {
  try {
    const { latitude, longitude } = ctx.message.location;

    const nearbyEvents = await searchService.searchNearbyEvents(latitude, longitude);
    const nearbyVenues = searchService.searchNearbyVenues(latitude, longitude);

    if (nearbyEvents.length === 0 && nearbyVenues.length === 0) {
      await ctx.reply(
        "😢 No events or venues found within 100km of your location.\n" +
        "Try expanding your search or ask about specific types of art!"
      );
      return;
    }

    let response = `📍 <b>Events Near You</b> (Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)})\n\n`;

    if (nearbyEvents.length > 0) {
      response += formatEventsList(nearbyEvents, `${nearbyEvents.length} Events Found`);
    }

    if (nearbyVenues.length > 0) {
      response += "\n\n";
      response += formatVenuesList(nearbyVenues, `${nearbyVenues.length} Venues Found`);
    }

    await ctx.reply(response, REPLY_OPTS);
  } catch (error) {
    console.error("Error handling location:", error);
    await ctx.reply("❌ Could not process your location. Please try again.");
  }
}

module.exports = { handleLocation };
