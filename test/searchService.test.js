const assert = require("node:assert/strict");
const test = require("node:test");

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
