// Media message handler

/**
 * Handles media messages (images, videos, etc)
 */
async function handleMedia(msg, client) {
  try {
    const mimeType = msg.type;

    // For now, just acknowledge media
    if (mimeType.includes("image")) {
      await msg.reply(
        "📸 Nice image! I can't analyze images yet, but feel free to ask me about art, photography, or events!"
      );
    } else if (mimeType.includes("video")) {
      await msg.reply(
        "🎬 Cool video! I can't watch videos yet, but ask me about films, cinema, or theatre!"
      );
    } else {
      await msg.reply(
        "📎 Thanks for sharing! I work best with text messages. Ask me about art, events, or museums!"
      );
    }
  } catch (error) {
    console.error("Error handling media:", error);
    await msg.reply("❌ Could not process media. Please try sending a text message instead.");
  }
}

module.exports = { handleMedia };
