const assert = require("node:assert/strict");
const test = require("node:test");

process.env.TICKETMASTER_API_KEY = "";

const searchService = require("../src/utils/searchService");
const { parseStayPeriod } = require("../src/utils/stayPeriod");
const { updateState } = require("../src/bot/conversationState");
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
    chat: { id: 1001 },
    message: {
      chat: { id: 1001 },
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

test("location handler stores location and asks for a category first", async () => {
  const ctx = createCtx();

  await handleLocation(ctx);

  assert.match(ctx.replies[0].message, /Got your location/);
  assert.equal(Boolean(ctx.replies[0].options.reply_markup.inline_keyboard), true);
});

test("location handler searches within 20km when category and duration are known", async () => {
  const originalEvents = searchService.searchNearbyEvents;
  const originalVenues = searchService.searchNearbyVenues;
  let radius;
  let options;
  const ctx = createCtx();
  updateState(ctx, { category: "museum", dateWindow: parseStayPeriod("3 days") });

  searchService.searchNearbyEvents = async (_lat, _lng, radiusKm, receivedOptions) => {
    radius = radiusKm;
    options = receivedOptions;
    return [];
  };
  searchService.searchNearbyVenues = () => [];

  try {
    await handleLocation(ctx);

    assert.equal(radius, DEFAULT_RADIUS_KM);
    assert.equal(options.category, "museum");
    assert.match(ctx.replies[0].message, /20km/);
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
  updateState(ctx, { category: "photography", dateWindow: parseStayPeriod("2 weeks") });

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
