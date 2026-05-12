const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildUrl,
  dateChipFromWindow,
  mapEvent,
  queryFor
} = require("../src/providers/serpApiProvider");
const { parseStayPeriod } = require("../src/utils/stayPeriod");

test("builds SerpApi Google Events URLs for city/category/date", () => {
  const dateWindow = parseStayPeriod("2 weeks", new Date("2026-05-12T10:00:00Z"));
  const url = buildUrl("serp-key", {
    q: queryFor("museum", { townName: "Dubai", dateWindow }),
    location: "Dubai",
    gl: "AE",
    htichips: dateChipFromWindow(dateWindow)
  });

  assert.equal(url.searchParams.get("engine"), "google_events");
  assert.equal(url.searchParams.get("api_key"), "serp-key");
  assert.match(url.searchParams.get("q"), /museum/);
  assert.match(url.searchParams.get("q"), /Dubai/);
  assert.equal(url.searchParams.get("location"), "Dubai");
  assert.equal(url.searchParams.get("gl"), "ae");
  assert.equal(url.searchParams.get("htichips"), "date:week");
});

test("normalizes SerpApi event results", () => {
  const mapped = mapEvent({
    event_id: "abc",
    title: "Dubai Photography Night",
    date: {
      start_date: "May 16",
      when: "Fri, 7 PM"
    },
    venue: {
      name: "Alserkal Avenue"
    },
    address: ["Dubai", "United Arab Emirates"],
    link: "https://example.com/event",
    ticket_info: [{ link: "https://example.com/tickets" }]
  }, "photography", { townName: "Dubai" });

  assert.equal(mapped.name, "Dubai Photography Night");
  assert.equal(mapped.category, "photography");
  assert.equal(mapped.locationText, "Alserkal Avenue, Dubai, United Arab Emirates");
  assert.equal(mapped.ticket_link, "https://example.com/tickets");
  assert.equal(mapped.source, "serpapi");
});
