const searchService = require("../../utils/searchService");
const { formatEventsList, formatVenuesList } = require("../../utils/formatter");
const { getState, updateState } = require("../conversationState");
const { mainMenuKeyboard } = require("../keyboards");

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

function optionsFromState(state = {}) {
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
    dateWindow: state.dateWindow
  };
}

async function replyNearbyResults(ctx, latitude, longitude, radiusKm, options = {}) {
  const nearbyEvents = await searchService.searchNearbyEvents(latitude, longitude, radiusKm, options);
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

  const titleBits = [`Events within ${radiusKm}km`];
  if (options.category) titleBits.push(options.category);
  if (options.dateWindow?.label) titleBits.push(options.dateWindow.label);
  let response = `📍 <b>${titleBits.join(" · ")}</b>\n\n`;

  if (nearbyEvents.length > 0) {
    response += formatEventsList(nearbyEvents, `${nearbyEvents.length} Events Found`);
  }

  if (nearbyVenues.length > 0) {
    response += "\n\n";
    response += formatVenuesList(
      nearbyVenues,
      nearbyEvents.length > 0
        ? `${nearbyVenues.length} Nearby Places`
        : `${nearbyVenues.length} Places You Can Still Visit`
    );
  }

  response += "\nTip: use /categories or search for free events, museums, photography, theatre, or workshops.";

  await ctx.reply(response, replyOptions(canExpand ? expandKeyboard(latitude, longitude) : {}));
}

async function handleLocation(ctx) {
  try {
    const { latitude, longitude } = ctx.message.location;
    const existing = getState(ctx);
    const state = updateState(ctx, {
      location: { latitude, longitude },
      townName: null,
      awaitingCategory: !existing.category,
      awaitingDuration: Boolean(existing.category && !existing.dateWindow)
    });

    if (!state.category) {
      await ctx.reply(
        "📍 Got your location. What kind of culture are you looking for?",
        replyOptions(mainMenuKeyboard())
      );
      return;
    }

    if (!state.dateWindow) {
      await ctx.reply(
        `Nice. How long are you staying or searching around here?\n\nTry: today, this weekend, 3 days, 2 weeks, or 1 month.`
      );
      return;
    }

    await replyNearbyResults(ctx, latitude, longitude, DEFAULT_RADIUS_KM, optionsFromState(state));
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
    const state = getState(ctx);

    await ctx.answerCbQuery(`Searching within ${radiusKm}km...`);
    await replyNearbyResults(ctx, latitude, longitude, radiusKm, optionsFromState(state));
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
  optionsFromState,
  replyNearbyResults
};
