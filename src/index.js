require("dotenv").config();

const { Telegraf } = require("telegraf");
const { handleText } = require("./bot/handlers/textHandler");
const { handleLocation } = require("./bot/handlers/locationHandler");
const { handleMedia } = require("./bot/handlers/mediaHandler");
const { handleError } = require("./bot/handlers/errorHandler");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start(ctx => handleText(ctx));
bot.on("text", ctx => handleText(ctx));
bot.on("location", ctx => handleLocation(ctx));
bot.on(["photo", "video", "audio", "voice", "document"], ctx => handleMedia(ctx));

bot.catch((error, ctx) => {
  handleError(error, `Update ${ctx.updateType}`);
});

bot.launch().then(() => {
  console.log("✅ 🎨 Salasil Bot is ready!");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("🚀 Salasil Bot starting...");
