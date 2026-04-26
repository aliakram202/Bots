function handleError(error, context = "") {
  console.error(`❌ Error${context ? ` [${context}]` : ""}: `, error.message);
  if (process.env.DEBUG === "true") {
    console.error("Stack trace:", error.stack);
  }
}

async function handleMessageError(ctx, error) {
  try {
    await ctx.reply("❌ An error occurred while processing your message. Please try again.");
  } catch (err) {
    console.error("Failed to send error message:", err);
  }
  handleError(error, "Message handler");
}

module.exports = { handleError, handleMessageError };
