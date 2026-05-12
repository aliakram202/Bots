const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { WELCOME_MSG } = require("../src/bot/handlers/textHandler");

test("welcome message lists commands and suggests tools", () => {
  assert.match(WELCOME_MSG, /\/start/);
  assert.match(WELCOME_MSG, /\/help/);
  assert.match(WELCOME_MSG, /\/categories/);
  assert.match(WELCOME_MSG, /\/health/);
  assert.match(WELCOME_MSG, /location/);
  assert.match(WELCOME_MSG, /20km/);
  assert.match(WELCOME_MSG, /50km/);
});

test("functionality reference documents commands, env vars, and runtime", () => {
  const docs = fs.readFileSync(path.join(__dirname, "..", "BOT_FUNCTIONALITY.md"), "utf8");

  assert.match(docs, /\/start/);
  assert.match(docs, /TICKETMASTER_API_KEY/);
  assert.match(docs, /20km/);
  assert.match(docs, /50km/);
  assert.match(docs, /npm start/);
});
