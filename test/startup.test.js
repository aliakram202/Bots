const assert = require("node:assert/strict");
const test = require("node:test");

test("constructs the bot without launching Telegram polling", () => {
  const { createBot } = require("../src/index");
  const bot = createBot();

  assert.ok(bot);
  assert.equal(typeof bot.launch, "function");
});
