const assert = require("node:assert/strict");
const test = require("node:test");

const { parseStayPeriod, toTicketmasterDateTime } = require("../src/utils/stayPeriod");

const NOW = new Date("2026-05-12T10:00:00Z");

test("parses day ranges", () => {
  const period = parseStayPeriod("3 days", NOW);

  assert.equal(period.label, "3 days");
  assert.equal(period.fallbackUsed, false);
  assert.equal(period.end.getUTCDate(), 14);
});

test("parses week ranges", () => {
  const period = parseStayPeriod("2 weeks", NOW);

  assert.equal(period.label, "2 weeks");
  assert.equal(period.end.getUTCDate(), 25);
});

test("parses weekend", () => {
  const period = parseStayPeriod("this weekend", NOW);

  assert.equal(period.label, "this weekend");
  assert.equal(period.start.getDay(), 6);
});

test("falls back to 7 days for unclear text", () => {
  const period = parseStayPeriod("a little while", NOW);

  assert.equal(period.label, "7 days");
  assert.equal(period.fallbackUsed, true);
});

test("formats Ticketmaster date-times without milliseconds", () => {
  assert.equal(toTicketmasterDateTime(NOW), "2026-05-12T10:00:00Z");
});
