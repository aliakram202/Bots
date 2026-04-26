// Location message handler

const searchService = require("../utils/searchService");
const { formatEventsList, formatVenuesList } = require("../utils/formatter");

/**
 * Handles location messages from users
 */
async function handleLocation(msg, client) {
  try {
    const location = msg.getLocation();

    if (!location) {
      await msg.reply("❌ Could not read location. Please try again.");
      return;
    }

    const { latitude, longitude } = location;

    // Search for nearby events
    const nearbyEvents = searchService.searchNearbyEvents(latitude, longitude);
    const nearbyVenues = searchService.searchNearbyVenues(latitude, longitude);

    if (nearbyEvents.length === 0 && nearbyVenues.length === 0) {
      await msg.reply(
        "😢 No events or venues found within 100km of your location.\n" +
        "Try expanding your search or ask about specific types of art!"
      );
      return;
    }

    // Format response with location context
    let response = `📍 *Events Near You* (Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)})\n\n`;

    if (nearbyEvents.length > 0) {
      response += formatEventsList(nearbyEvents, `${nearbyEvents.length} Events Found`);
    }

    if (nearbyVenues.length > 0) {
      response += "\n\n";
      response += formatVenuesList(nearbyVenues, `${nearbyVenues.length} Venues Found`);
    }

    await msg.reply(response);
  } catch (error) {
    console.error("Error handling location:", error);
    await msg.reply(
      "❌ Could not process your location. Please ensure location sharing is enabled."
    );
  }
}

module.exports = { handleLocation };
