// Error handling

/**
 * Global error handler
 */
function handleError(error, context = "") {
  console.error(`❌ Error${context ? ` [${context}]` : ""}: `, error.message);
  if (process.env.DEBUG === "true") {
    console.error("Stack trace:", error.stack);
  }
}

/**
 * Message error handler
 */
async function handleMessageError(msg, error) {
  try {
    await msg.reply(
      "❌ An error occurred while processing your message. Please try again or contact support."
    );
  } catch (err) {
    console.error("Failed to send error message:", err);
  }
  handleError(error, "Message handler");
}

module.exports = {
  handleError,
  handleMessageError
};
