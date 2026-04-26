// Intent detection engine - recognizes user intent from natural language
const INTENTS = {
  museum: {
    keywords: ["museum", "gallery", "exhibition", "cultural", "heritage", "collection", "artifact", "masterpiece"],
    arabic: ["متحف", "معرض", "معرض فني", "تراث", "مجموعة", "آثار", "أثرية"]
  },
  art: {
    keywords: ["art", "painting", "sculpture", "installation", "contemporary", "artist", "artwork"],
    arabic: ["فن", "لوحة", "رسم", "تمثال", "فنان", "معاصر", "فني"]
  },
  workshop: {
    keywords: ["workshop", "class", "lesson", "course", "training", "session", "hands-on"],
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
    keywords: ["ticket", "booking", "reserve", "buy ticket", "entrance fee"],
    arabic: ["تذكرة", "حجز", "دخول", "رسم دخول", "حجز تذكرة"]
  },
  nearby: {
    keywords: ["near", "nearby", "close", "around", "near me", "local"],
    arabic: ["قريب", "بالقرب", "محلي", "قريبة", "بجانبي"]
  }
};

/**
 * Detects user intent from a text message
 * @param {string} text - User message
 * @returns {string|null} - Intent type or null if no match
 */
function detectIntent(text) {
  const lower = text.toLowerCase().trim();

  // Check each intent
  for (const [intent, patterns] of Object.entries(INTENTS)) {
    // Check English keywords
    for (const keyword of patterns.keywords) {
      if (lower.includes(keyword)) {
        return intent;
      }
    }

    // Check Arabic keywords
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
  const lower = text.toLowerCase().trim();

  for (const [intent, patterns] of Object.entries(INTENTS)) {
    // Check English keywords
    if (patterns.keywords.some(k => lower.includes(k))) {
      intents.add(intent);
      continue;
    }

    // Check Arabic keywords
    if (patterns.arabic.some(k => text.includes(k))) {
      intents.add(intent);
    }
  }

  return Array.from(intents);
}

module.exports = {
  detectIntent,
  detectIntents,
  INTENTS
};
