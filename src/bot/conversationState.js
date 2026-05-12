const states = new Map();

function chatIdFromContext(ctx) {
  return String(ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id || ctx.message?.chat?.id || "unknown");
}

function getState(ctx) {
  return states.get(chatIdFromContext(ctx)) || {};
}

function updateState(ctx, patch) {
  const chatId = chatIdFromContext(ctx);
  const next = {
    ...(states.get(chatId) || {}),
    ...patch,
    updatedAt: new Date().toISOString()
  };
  states.set(chatId, next);
  return next;
}

function clearState(ctx) {
  states.delete(chatIdFromContext(ctx));
}

module.exports = {
  chatIdFromContext,
  clearState,
  getState,
  updateState
};
