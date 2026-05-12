require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name, fallback = "") {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  botName: optional("BOT_NAME", "Salasil Bot"),
  debug: optional("DEBUG", "false") === "true",
  ticketmasterApiKey: optional("TICKETMASTER_API_KEY"),
  ticketmasterCountryCode: optional("TICKETMASTER_COUNTRY_CODE")
};

module.exports = { config };
