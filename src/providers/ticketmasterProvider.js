const geohash = require("ngeohash");

const BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json";

const CATEGORY_KEYWORDS = {
  museum: "museum exhibition",
  art: "art exhibition",
  workshop: "art workshop",
  festival: "art festival",
  photography: "photography",
  cinema: "film cinema",
  theatre: "theatre",
  books: "literature book"
};

const ARAB_COUNTRY_CODES = new Set([
  "AE", "BH", "DZ", "EG", "IQ", "JO", "KW", "LB", "LY", "MA", "OM", "PS",
  "QA", "SA", "SD", "SY", "TN", "YE"
]);

function getVenue(event) {
  return event?._embedded?.venues?.[0] || {};
}

function getLocation(venue) {
  const lat = Number(venue?.location?.latitude);
  const lng = Number(venue?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function categoryFromEvent(event, fallback = "art") {
  const text = [
    event?.classifications?.[0]?.segment?.name,
    event?.classifications?.[0]?.genre?.name,
    event?.classifications?.[0]?.subGenre?.name,
    event?.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("film") || text.includes("cinema")) return "cinema";
  if (text.includes("photography")) return "photography";
  if (text.includes("theatre") || text.includes("theater") || text.includes("arts")) return "theatre";
  if (text.includes("book") || text.includes("literature")) return "books";
  if (text.includes("festival")) return "festival";
  return fallback;
}

function mapEvent(event, fallbackCategory = "art") {
  const venue = getVenue(event);
  const location = getLocation(venue);
  const countryCode = venue?.country?.countryCode;

  if (!location) {
    return null;
  }

  const date = event?.dates?.start?.localDate || "";
  const time = event?.dates?.start?.localTime || "";
  const openingTimes = [date, time].filter(Boolean).join(" ") || "See ticket link";
  const venueParts = [venue?.name, venue?.city?.name, countryCode].filter(Boolean);

  return {
    id: `ticketmaster-${event.id}`,
    name: event.name,
    category: categoryFromEvent(event, fallbackCategory),
    location,
    region: ARAB_COUNTRY_CODES.has(countryCode) ? "arab" : "international",
    description: venueParts.length > 0 ? venueParts.join(", ") : "Live event from Ticketmaster",
    opening_times: openingTimes,
    website: event.url,
    ticket_link: event.url,
    free: false,
    source: "ticketmaster"
  };
}

function buildUrl(apiKey, params) {
  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("size", String(params.size || 10));
  url.searchParams.set("sort", params.sort || "date,asc");
  url.searchParams.set("locale", "*");

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (["size", "sort"].includes(key)) return;
    url.searchParams.set(key, String(value));
  });

  return url;
}

async function fetchEvents(apiKey, params, fallbackCategory) {
  if (!apiKey) {
    return [];
  }

  const response = await fetch(buildUrl(apiKey, params));
  if (!response.ok) {
    throw new Error(`Ticketmaster request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?._embedded?.events || [])
    .map(event => mapEvent(event, fallbackCategory))
    .filter(Boolean);
}

async function searchByCategory(apiKey, category, options = {}) {
  return fetchEvents(apiKey, {
    keyword: CATEGORY_KEYWORDS[category] || category,
    countryCode: options.countryCode
  }, category);
}

async function searchEvents(apiKey, query, options = {}) {
  return fetchEvents(apiKey, {
    keyword: query,
    countryCode: options.countryCode
  }, "art");
}

async function searchNearbyEvents(apiKey, lat, lng, radiusKm = 100, options = {}) {
  return fetchEvents(apiKey, {
    geoPoint: geohash.encode(Number(lat), Number(lng), 9),
    radius: radiusKm,
    unit: "km",
    countryCode: options.countryCode,
    sort: "distance,asc"
  }, "art");
}

module.exports = {
  searchByCategory,
  searchEvents,
  searchNearbyEvents,
  buildUrl,
  mapEvent
};
