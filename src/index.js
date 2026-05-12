const { Telegraf } = require("telegraf");
const { config } = require("./config");
const { handleText } = require("./bot/handlers/textHandler");
const { handleLocation } = require("./bot/handlers/locationHandler");
const { handleMedia } = require("./bot/handlers/mediaHandler");
const { handleError } = require("./bot/handlers/errorHandler");

function createBot() {
  const bot = new Telegraf(config.telegramBotToken);

  bot.start(ctx => handleText(ctx));
  bot.command("help", ctx => handleText(ctx));
  bot.command("health", ctx => handleText(ctx));
  bot.command("categories", ctx => handleText(ctx));
  bot.action(/^category:(.+)$/, ctx => handleText(ctx));
  bot.action("nearby:help", ctx => handleText(ctx));
  bot.on("text", ctx => handleText(ctx));
  bot.on("location", ctx => handleLocation(ctx));
  bot.on(["photo", "video", "audio", "voice", "document"], ctx => handleMedia(ctx));

  bot.catch((error, ctx) => {
    handleError(error, `Update ${ctx.updateType}`);
  });

  return bot;
}

async function startBot() {
  const bot = createBot();

  await bot.launch();
  console.log("Salasil Bot is ready.");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  return bot;
}

if (require.main === module) {
  console.log("Salasil Bot starting...");
  startBot().catch(error => {
    handleError(error, "Startup");
    process.exitCode = 1;
  });
}

module.exports = { createBot, startBot };
