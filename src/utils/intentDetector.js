// Intent detection engine - recognizes user intent from natural language
const INTENTS = {
  museum: {
    keywords: ["museum", "musem", "museam", "gallery", "gallary", "exhibition", "exibit", "cultural", "heritage", "collection", "artifact", "masterpiece"],
    arabic: ["متحف", "معرض", "معرض فني", "تراث", "مجموعة", "آثار", "أثرية"]
  },
  art: {
    keywords: ["art", "arts", "painting", "paintings", "sculpture", "installation", "contemporary", "artist", "artwork"],
    arabic: ["فن", "لوحة", "رسم", "تمثال", "فنان", "معاصر", "فني"]
  },
  workshop: {
    keywords: ["workshop", "workshops", "class", "lesson", "course", "training", "session", "hands-on"],
    arabic: ["ورشة", "درس", "دورة", "تدريب", "جلسة", "عملي"]
  },
  festival: {
    keywords: ["festival", "fair", "celebration", "event", "showcase", "market", "bazaar"],
    arabic: ["مهرجان", "معرض", "احتفال", "سوق", "حدث"]
  },
  photography: {
    keywords: ["photo", "photography", "photographer", "portrait", "visual", "image"],
    arabic: ["صورة", "صور", "تصوير", "مصور", "صورة فوتوغرافية"]
  },
  cinema: {
    keywords: ["cinema", "film", "movie", "screening", "documentary", "cinema hall"],
    arabic: ["سينما", "فيلم", "أفلام", "عرض سينمائي", "مهرجان سينمائي"]
  },
  theatre: {
    keywords: ["theatre", "theater", "performance", "dance", "ballet", "opera", "play"],
    arabic: ["مسرح", "عرض", "رقص", "أداء", "عرض مسرحي"]
  },
  books: {
    keywords: ["book", "books", "reading", "literature", "author", "poetry", "reading group"],
    arabic: ["كتاب", "كتب", "قراءة", "أدب", "كاتب", "شاعر", "شعر", "مؤلف"]
  },
  free: {
    keywords: ["free", "no cost", "gratis", "without charge", "complimentary"],
    arabic: ["مجاني", "بدون رسوم", "مجانا", "مجانية"]
  },
  tickets: {
    keywords: ["ticket", "tickets", "booking", "reserve", "buy ticket", "entrance fee"],
    arabic: ["تذكرة", "حجز", "دخول", "رسم دخول", "حجز تذكرة"]
  },
  nearby: {
    keywords: ["near", "nearby", "close", "around", "near me", "local"],
    arabic: ["قريب", "بالقرب", "محلي", "قريبة", "بجانبي"]
  }
};

const CATEGORY_INTENTS = [
  "museum",
  "art",
  "workshop",
  "festival",
  "photography",
  "cinema",
  "theatre",
  "books"
];

const LOCATION_ALIASES = [
  "baghdad",
  "sulaymaniyah",
  "amman",
  "cairo",
  "doha",
  "jerusalem",
  "beirut",
  "damascus",
  "abu dhabi",
  "marrakech",
  "paris",
  "new york",
  "london",
  "berlin",
  "tokyo"
];

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasKeyword(text, keyword) {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(normalizedKeyword)}($|\\s)`, "u").test(normalizedText);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detects user intent from a text message
 * @param {string} text - User message
 * @returns {string|null} - Intent type or null if no match
 */
function detectIntent(text) {
  for (const [intent, patterns] of Object.entries(INTENTS)) {
    for (const keyword of patterns.keywords) {
      if (hasKeyword(text, keyword)) {
        return intent;
      }
    }

    for (const keyword of patterns.arabic) {
      if (text.includes(keyword)) {
        return intent;
      }
    }
  }

  return null;
}

/**
 * Detects multiple intents from text
 * @param {string} text - User message
 * @returns {string[]} - Array of matched intent types
 */
function detectIntents(text) {
  const intents = new Set();

  for (const [intent, patterns] of Object.entries(INTENTS)) {
    if (patterns.keywords.some(k => hasKeyword(text, k))) {
      intents.add(intent);
      continue;
    }

    if (patterns.arabic.some(k => text.includes(k))) {
      intents.add(intent);
    }
  }

  return Array.from(intents);
}

function parseQuery(text) {
  const intents = detectIntents(text);
  const normalized = normalizeText(text);

  return {
    intents,
    primaryIntent: intents.find(intent => CATEGORY_INTENTS.includes(intent)) || intents[0] || null,
    category: intents.find(intent => CATEGORY_INTENTS.includes(intent)) || null,
    freeOnly: intents.includes("free"),
    ticketedOnly: intents.includes("tickets"),
    nearby: intents.includes("nearby"),
    locationName: LOCATION_ALIASES.find(location => normalized.includes(location)) || null
  };
}

module.exports = {
  detectIntent,
  detectIntents,
  parseQuery,
  normalizeText,
  LOCATION_ALIASES,
  INTENTS
};
