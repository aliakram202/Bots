const assert = require("node:assert/strict");
const test = require("node:test");

const {
  escapeHtml,
  formatEventsGrouped,
  googleMapsUrl
} = require("../src/utils/formatter");

test("escapes Telegram HTML-sensitive characters", () => {
  assert.equal(escapeHtml("<Art & Film>"), "&lt;Art &amp; Film&gt;");
});

test("escapes event fields in formatted replies", () => {
  const message = formatEventsGrouped([
    {
      name: "A&B <Show>",
      category: "art",
      location: { lat: 1, lng: 2 },
      locationText: "Hall & City <DE>",
      region: "arab",
      description: "5 > 3 & 2 < 4",
      opening_times: "Today",
      website: "https://example.com?a=1&b=2",
      ticket_link: "https://tickets.example.com?a=1&b=2",
      free: true
    }
  ]);

  assert.match(message, /A&amp;B &lt;Show&gt;/);
  assert.match(message, /Hall &amp; City &lt;DE&gt;/);
  assert.match(message, />Open in Maps<\/a>/);
  assert.match(message, />Event page<\/a>/);
  assert.match(message, />Tickets<\/a>/);
  assert.doesNotMatch(message, /🗺️ https:\/\/www\.google\.com/);
});

test("builds Google Maps URLs from coordinates", () => {
  assert.equal(googleMapsUrl({ lat: 1, lng: 2 }), "https://www.google.com/maps/search/?api=1&query=1%2C2");
});
