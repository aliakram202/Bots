const assert = require("node:assert/strict");
const test = require("node:test");

process.env.TICKETMASTER_API_KEY = "";

const searchService = require("../src/utils/searchService");
const {
  DEFAULT_RADIUS_KM,
  EXPANDED_RADIUS_KM,
  expandKeyboard,
  handleLocation,
  handleNearbyRadius
} = require("../src/bot/handlers/locationHandler");

function createCtx() {
  const replies = [];
  return {
    replies,
    message: {
      location: {
        latitude: 33.3152,
        longitude: 44.3661
      }
    },
    async reply(message, options) {
      replies.push({ message, options });
    },
    async answerCbQuery() {}
  };
}

test("location handler searches within 20km by default", async () => {
  const originalEvents = searchService.searchNearbyEvents;
  const originalVenues = searchService.searchNearbyVenues;
  let radius;
  const ctx = createCtx();

  searchService.searchNearbyEvents = async (_lat, _lng, radiusKm) => {
    radius = radiusKm;
    return [];
  };
  searchService.searchNearbyVenues = () => [];

  try {
    await handleLocation(ctx);

    assert.equal(radius, DEFAULT_RADIUS_KM);
    assert.match(ctx.replies[0].message, /20km/);
    assert.equal(ctx.replies[0].options.reply_markup.inline_keyboard[0][0].text, "Expand to 50km");
  } finally {
    searchService.searchNearbyEvents = originalEvents;
    searchService.searchNearbyVenues = originalVenues;
  }
});

test("nearby expansion searches within 50km", async () => {
  const originalEvents = searchService.searchNearbyEvents;
  const originalVenues = searchService.searchNearbyVenues;
  let radius;
  const ctx = createCtx();
  ctx.match = ["nearby:50:33.3152:44.3661", "50", "33.3152", "44.3661"];

  searchService.searchNearbyEvents = async (_lat, _lng, radiusKm) => {
    radius = radiusKm;
    return [];
  };
  searchService.searchNearbyVenues = () => [];

  try {
    await handleNearbyRadius(ctx);

    assert.equal(radius, EXPANDED_RADIUS_KM);
    assert.match(ctx.replies[0].message, /50km/);
  } finally {
    searchService.searchNearbyEvents = originalEvents;
    searchService.searchNearbyVenues = originalVenues;
  }
});

test("expand keyboard stores rounded coordinates", () => {
  const keyboard = expandKeyboard(33.315234, 44.366166);
  const callback = keyboard.reply_markup.inline_keyboard[0][0].callback_data;

  assert.equal(callback, "nearby:50:33.3152:44.3662");
});
