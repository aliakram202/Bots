const searchService = require("../../utils/searchService");
const { formatEventsList, formatVenuesList } = require("../../utils/formatter");

const REPLY_OPTS = { parse_mode: "HTML" };
const DEFAULT_RADIUS_KM = 20;
const EXPANDED_RADIUS_KM = 50;

function expandKeyboard(latitude, longitude) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Expand to 50km",
            callback_data: `nearby:${EXPANDED_RADIUS_KM}:${latitude.toFixed(4)}:${longitude.toFixed(4)}`
          }
        ]
      ]
    }
  };
}

function replyOptions(extra = {}) {
  return { ...REPLY_OPTS, ...extra };
}

async function replyNearbyResults(ctx, latitude, longitude, radiusKm) {
  const nearbyEvents = await searchService.searchNearbyEvents(latitude, longitude, radiusKm);
  const nearbyVenues = searchService.searchNearbyVenues(latitude, longitude, radiusKm);
  const canExpand = radiusKm < EXPANDED_RADIUS_KM;

  if (nearbyEvents.length === 0 && nearbyVenues.length === 0) {
    await ctx.reply(
      `No events or venues found within ${radiusKm}km of your location.\n` +
        (canExpand
          ? "Try expanding the search to 50km, or ask about a category like museums, photography, or free events."
          : "Try a category search like museums, photography, theatre, or free events."),
      replyOptions(canExpand ? expandKeyboard(latitude, longitude) : {})
    );
    return;
  }

  let response = `📍 <b>Events within ${radiusKm}km</b> (Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)})\n\n`;

  if (nearbyEvents.length > 0) {
    response += formatEventsList(nearbyEvents, `${nearbyEvents.length} Events Found`);
  }

  if (nearbyVenues.length > 0) {
    response += "\n\n";
    response += formatVenuesList(nearbyVenues, `${nearbyVenues.length} Venues Found`);
  }

  response += "\nTip: use /categories or search for free events, museums, photography, theatre, or workshops.";

  await ctx.reply(response, replyOptions(canExpand ? expandKeyboard(latitude, longitude) : {}));
}

async function handleLocation(ctx) {
  try {
    const { latitude, longitude } = ctx.message.location;

    await replyNearbyResults(ctx, latitude, longitude, DEFAULT_RADIUS_KM);
  } catch (error) {
    console.error("Error handling location:", error);
    await ctx.reply("Could not process your location. Please try again.");
  }
}

async function handleNearbyRadius(ctx) {
  try {
    const radiusKm = Number(ctx.match[1]);
    const latitude = Number(ctx.match[2]);
    const longitude = Number(ctx.match[3]);

    await ctx.answerCbQuery(`Searching within ${radiusKm}km...`);
    await replyNearbyResults(ctx, latitude, longitude, radiusKm);
  } catch (error) {
    console.error("Error handling nearby expansion:", error);
    await ctx.reply("Could not expand the nearby search. Please send your location again.");
  }
}

module.exports = {
  DEFAULT_RADIUS_KM,
  EXPANDED_RADIUS_KM,
  expandKeyboard,
  handleLocation,
  handleNearbyRadius,
  replyNearbyResults
};
