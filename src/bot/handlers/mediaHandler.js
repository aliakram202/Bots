async function handleMedia(ctx) {
  try {
    if (ctx.message.photo) {
      await ctx.reply("Nice image. I can't analyze images yet, but you can ask me about art, photography, free events, or send your location for nearby events.");
    } else if (ctx.message.video) {
      await ctx.reply("Cool video. I can't watch videos yet, but ask me about films, cinema, theatre, or use /categories.");
    } else if (ctx.message.voice || ctx.message.audio) {
      await ctx.reply("Voice messages are not supported yet. Send text like 'free photography in Baghdad' or share your location.");
    } else {
      await ctx.reply("Thanks for sharing. I work best with text messages and locations. Try /help or /categories.");
    }
  } catch (error) {
    console.error("Error handling media:", error);
    await ctx.reply("Could not process media. Please try sending text or location instead.");
  }
}

module.exports = { handleMedia };
