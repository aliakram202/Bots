const categoryButtons = [
  [
    { text: "Museums", callback_data: "category:museum" },
    { text: "Art", callback_data: "category:art" }
  ],
  [
    { text: "Photography", callback_data: "category:photography" },
    { text: "Theatre", callback_data: "category:theatre" }
  ],
  [
    { text: "Free events", callback_data: "category:free" },
    { text: "Nearby", callback_data: "nearby:help" }
  ]
];

function mainMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: categoryButtons
    }
  };
}

module.exports = { mainMenuKeyboard };
