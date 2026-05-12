const assert = require("node:assert/strict");
const test = require("node:test");

const { clearState, getState } = require("../src/bot/conversationState");
const { handleText, isLikelyTownName } = require("../src/bot/handlers/textHandler");

function createCtx(text, overrides = {}) {
  const replies = [];
  const chatId = overrides.chatId || 9001;
  return {
    replies,
    chat: { id: chatId },
    message: {
      chat: { id: chatId },
      text
    },
    async reply(message, options) {
      replies.push({ message, options });
    },
    async answerCbQuery() {},
    async sendChatAction() {},
    ...overrides
  };
}

test("detects likely town names", () => {
  assert.equal(isLikelyTownName("Braunschweig"), true);
  assert.equal(isLikelyTownName("free photography"), false);
  assert.equal(isLikelyTownName("3 days"), false);
});

test("town input stores town and asks for category", async () => {
  const ctx = createCtx("Braunschweig", { chatId: 9002 });
  clearState(ctx);

  await handleText(ctx);

  assert.equal(getState(ctx).townName, "Braunschweig");
  assert.match(ctx.replies[0].message, /What kind of culture/);
  assert.equal(Boolean(ctx.replies[0].options.reply_markup.inline_keyboard), true);
});

test("category callback with stored town asks for duration", async () => {
  const townCtx = createCtx("Braunschweig", { chatId: 9003 });
  clearState(townCtx);
  await handleText(townCtx);

  const callbackCtx = createCtx("", {
    chatId: 9003,
    callbackQuery: { data: "category:museum" },
    match: ["category:museum", "museum"]
  });

  await handleText(callbackCtx);

  assert.equal(getState(callbackCtx).category, "museum");
  assert.match(callbackCtx.replies[0].message, /How long/);
});
