const assert = require("node:assert/strict");
const test = require("node:test");

const {
  detectIntent,
  detectIntents,
  normalizeText,
  parseQuery
} = require("../src/utils/intentDetector");

test("detects English intent with typo aliases", () => {
  assert.equal(detectIntent("any museam exhibitions?"), "museum");
});

test("detects Arabic intent", () => {
  assert.equal(detectIntent("أريد معرض فني"), "museum");
});

test("extracts compound query flags", () => {
  const parsed = parseQuery("free photography in Baghdad");

  assert.equal(parsed.category, "photography");
  assert.equal(parsed.freeOnly, true);
  assert.equal(parsed.locationName, "baghdad");
});

test("detects multiple intents", () => {
  assert.deepEqual(detectIntents("free theatre tickets").sort(), ["free", "theatre", "tickets"].sort());
});

test("normalizes punctuation and casing", () => {
  assert.equal(normalizeText("  Modern, ART!!! "), "modern art");
});
