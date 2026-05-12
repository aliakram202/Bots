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
    { text: "Workshops", callback_data: "category:workshop" },
    { text: "Festivals", callback_data: "category:festival" }
  ],
  [
    { text: "Cinema", callback_data: "category:cinema" },
    { text: "Books", callback_data: "category:books" }
  ],
  [
    { text: "Free events", callback_data: "category:free" },
    { text: "Tickets", callback_data: "category:tickets" }
  ],
  [
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
