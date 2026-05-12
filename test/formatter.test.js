const assert = require("node:assert/strict");
const test = require("node:test");

const {
  escapeHtml,
  formatEventsGrouped
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
      region: "arab",
      description: "5 > 3 & 2 < 4",
      opening_times: "Today",
      website: "https://example.com?a=1&b=2",
      free: true
    }
  ]);

  assert.match(message, /A&amp;B &lt;Show&gt;/);
  assert.match(message, /5 &gt; 3 &amp; 2 &lt; 4/);
});
