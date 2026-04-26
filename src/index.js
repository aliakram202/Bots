// Main bot entry point
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { handleText } = require("./bot/handlers/textHandler");
const { handleLocation } = require("./bot/handlers/locationHandler");
const { handleMedia } = require("./bot/handlers/mediaHandler");
const { handleError, handleMessageError } = require("./bot/handlers/errorHandler");

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

// QR code generation
client.on("qr", qr => {
  console.log("\n📱 Scan this QR code with WhatsApp:");
  qrcode.generate(qr, { small: true });
});

// Ready event
client.on("ready", () => {
  console.log("✅ 🎨 Salasil Bot is ready!");
});

// Authentication
client.on("authenticated", () => {
  console.log("✅ Authenticated successfully!");
});

// Message handler - routes to specific handlers
client.on("message", async msg => {
  try {
    // Skip group messages and bot's own messages
    if (msg.from.includes("@g.us")) {
      return;
    }

    // Route by message type
    if (msg.hasLocation) {
      await handleLocation(msg, client);
    } else if (msg.type === "ptt" || msg.type.includes("audio")) {
      // Audio handling
      await msg.reply("🎙️ Voice messages aren't supported yet, but I'm learning!");
    } else if (
      msg.type.includes("image") ||
      msg.type.includes("video") ||
      msg.type.includes("media")
    ) {
      // Media handling
      await handleMedia(msg, client);
    } else if (msg.body) {
      // Text handling
      await handleText(msg, client);
    }
  } catch (error) {
    await handleMessageError(msg, error);
  }
});

// Connection lost
client.on("disconnected", reason => {
  console.log("❌ Disconnected:", reason);
});

// Error handling
client.on("error", error => {
  handleError(error, "Client");
});

// Initialize
client.initialize().catch(error => {
  handleError(error, "Initialization");
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n📴 Shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

console.log("🚀 Salasil Bot starting...");
