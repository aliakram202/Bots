async function handleMedia(ctx) {
  try {
    if (ctx.message.photo) {
      await ctx.reply("📸 Nice image! I can't analyze images yet, but feel free to ask me about art, photography, or events!");
    } else if (ctx.message.video) {
      await ctx.reply("🎬 Cool video! I can't watch videos yet, but ask me about films, cinema, or theatre!");
    } else if (ctx.message.voice || ctx.message.audio) {
      await ctx.reply("🎙️ Voice messages aren't supported yet, but I'm learning!");
    } else {
      await ctx.reply("📎 Thanks for sharing! I work best with text messages. Ask me about art, events, or museums!");
    }
  } catch (error) {
    console.error("Error handling media:", error);
    await ctx.reply("❌ Could not process media. Please try sending a text message instead.");
  }
}

module.exports = { handleMedia };
