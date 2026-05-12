const assert = require("node:assert/strict");
const test = require("node:test");

process.env.TICKETMASTER_API_KEY = "";
process.env.SERPAPI_API_KEY = "";

const { config } = require("../src/config");
const serpApiProvider = require("../src/providers/serpApiProvider");
const ticketmasterProvider = require("../src/providers/ticketmasterProvider");
const searchService = require("../src/utils/searchService");

test("searches local events by category through fallback path", async () => {
  const museums = await searchService.searchByCategory("museum");

  assert.ok(museums.length > 0);
  assert.ok(museums.every(event => event.category === "museum"));
});

test("filters local category results by free flag", async () => {
  const results = await searchService.searchByCategory("festival", { freeOnly: true });

  assert.ok(results.length > 0);
  assert.ok(results.every(event => event.category === "festival" && event.free === true));
});

test("finds ticketed fallback events", async () => {
  const results = await searchService.searchTicketedEvents();

  assert.ok(results.every(event => event.ticket_link));
});

test("finds nearby local events by distance", async () => {
  const results = await searchService.searchNearbyEvents(33.3156, 44.3615, 5);

  assert.ok(results.length > 0);
  assert.ok(results.every(event => event.distance <= 5));
});

test("filters by location name when possible", async () => {
  const results = await searchService.searchByCategory("museum", { locationName: "baghdad" });

  assert.ok(results.length > 0);
  assert.ok(results.every(event => `${event.name} ${event.description}`.toLowerCase().includes("baghdad")));
});

test("aggregator prefers SerpApi results when available", async () => {
  const originalSerp = serpApiProvider.searchByCategory;
  const originalTicketmaster = ticketmasterProvider.searchByCategory;
  const originalSerpKey = config.serpApiKey;
  const originalTicketmasterKey = config.ticketmasterApiKey;
  let ticketmasterCalled = false;

  config.serpApiKey = "serp-key";
  config.ticketmasterApiKey = "ticketmaster-key";
  serpApiProvider.searchByCategory = async () => [{
    name: "Serp Museum Event",
    category: "museum",
    location: { lat: 1, lng: 2 },
    source: "serpapi"
  }];
  ticketmasterProvider.searchByCategory = async () => {
    ticketmasterCalled = true;
    return [];
  };

  try {
    const results = await searchService.searchByCategory("museum");

    assert.equal(results[0].source, "serpapi");
    assert.equal(ticketmasterCalled, false);
  } finally {
    serpApiProvider.searchByCategory = originalSerp;
    ticketmasterProvider.searchByCategory = originalTicketmaster;
    config.serpApiKey = originalSerpKey;
    config.ticketmasterApiKey = originalTicketmasterKey;
  }
});

test("aggregator falls back to Ticketmaster when SerpApi is empty", async () => {
  const originalSerp = serpApiProvider.searchByCategory;
  const originalTicketmaster = ticketmasterProvider.searchByCategory;
  const originalSerpKey = config.serpApiKey;
  const originalTicketmasterKey = config.ticketmasterApiKey;

  config.serpApiKey = "serp-key";
  config.ticketmasterApiKey = "ticketmaster-key";
  serpApiProvider.searchByCategory = async () => [];
  ticketmasterProvider.searchByCategory = async () => [{
    name: "Ticketmaster Theatre",
    category: "theatre",
    location: { lat: 1, lng: 2 },
    source: "ticketmaster"
  }];

  try {
    const results = await searchService.searchByCategory("theatre");

    assert.equal(results[0].source, "ticketmaster");
  } finally {
    serpApiProvider.searchByCategory = originalSerp;
    ticketmasterProvider.searchByCategory = originalTicketmaster;
    config.serpApiKey = originalSerpKey;
    config.ticketmasterApiKey = originalTicketmasterKey;
  }
});

test("venue fallback returns matching places separately from events", () => {
  const venues = searchService.searchVenueFallback({ townName: "cairo", category: "museum" });

  assert.ok(venues.length > 0);
  assert.ok(venues.every(venue => `${venue.name} ${venue.description}`.toLowerCase().includes("cairo")));
});
