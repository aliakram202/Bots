const BASE_URL = "https://serpapi.com/search";

const CATEGORY_KEYWORDS = {
  museum: "museum exhibitions",
  art: "art exhibitions galleries",
  workshop: "art workshops",
  festival: "culture festivals",
  photography: "photography exhibitions",
  cinema: "film cinema screenings",
  theatre: "theatre performances",
  books: "book literature events",
  free: "free cultural events",
  tickets: "ticketed cultural events"
};

function dateChipFromWindow(dateWindow) {
  const label = String(dateWindow?.label || "").toLowerCase();
  if (!label) return "";
  if (label.includes("today")) return "date:today";
  if (label.includes("tomorrow")) return "date:tomorrow";
  if (label.includes("week")) return "date:week";
  if (label.includes("month")) return "date:month";
  return "";
}

function queryFor(category, options = {}) {
  const keyword = CATEGORY_KEYWORDS[category] || category || "cultural events";
  const town = options.townName || options.locationName;
  const period = options.dateWindow?.label;
  return [keyword, "events", town ? `in ${town}` : "", period || ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildUrl(apiKey, params = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set("engine", "google_events");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", params.q || "cultural events");
  url.searchParams.set("hl", params.hl || "en");

  if (params.location) url.searchParams.set("location", params.location);
  if (params.gl) url.searchParams.set("gl", params.gl.toLowerCase());
  if (params.htichips) url.searchParams.set("htichips", params.htichips);
  if (params.start) url.searchParams.set("start", String(params.start));

  return url;
}

function firstTicketLink(event) {
  const ticketInfo = event.ticket_info || event.tickets || [];
  const first = Array.isArray(ticketInfo) ? ticketInfo[0] : null;
  return first?.link || first?.source_link || event.link || event.event_location_map?.link || "";
}

function dateText(event) {
  if (typeof event.date === "string") return event.date;
  return [event.date?.start_date, event.date?.when || event.time].filter(Boolean).join(" ");
}

function normalizedStartDate(event) {
  const startDate = event.date?.start_date;
  return /^\d{4}-\d{2}-\d{2}/.test(startDate || "") ? startDate : "";
}

function mapEvent(event, fallbackCategory = "art", options = {}) {
  const venue = event.venue || {};
  const address = Array.isArray(event.address) ? event.address.join(", ") : event.address;
  const locationText = [venue.name || event.venue_name, address].filter(Boolean).join(", ");
  const link = event.link || event.event_location_map?.link || "";

  return {
    id: `serpapi-${event.event_id || event.title || link}`,
    name: event.title || event.name,
    category: fallbackCategory,
    location: null,
    locationText: locationText || options.townName || "Event location",
    startDate: normalizedStartDate(event),
    startDateTime: dateText(event) || options.dateWindow?.label || "See event details",
    venueName: venue.name || event.venue_name || "",
    cityName: options.townName || "",
    countryCode: options.countryCode || "",
    region: "international",
    description: event.description || locationText || "Google Events result",
    opening_times: dateText(event) || "See event details",
    website: link,
    ticket_link: firstTicketLink(event),
    source: "serpapi"
  };
}

async function fetchEvents(apiKey, category, options = {}) {
  if (!apiKey) return [];

  const url = buildUrl(apiKey, {
    q: queryFor(category, options),
    location: options.townName || options.locationName,
    gl: options.countryCode,
    htichips: dateChipFromWindow(options.dateWindow)
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpApi request failed with ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`SerpApi error: ${data.error}`);
  }

  return (data.events_results || [])
    .map(event => mapEvent(event, category, options))
    .filter(event => event.name);
}

async function searchByCategory(apiKey, category, options = {}) {
  return fetchEvents(apiKey, category, options);
}

async function searchEvents(apiKey, query, options = {}) {
  return fetchEvents(apiKey, query || options.category || "art", options);
}

async function searchNearbyEvents(apiKey, lat, lng, _radiusKm = 20, options = {}) {
  return fetchEvents(apiKey, options.category || "cultural", {
    ...options,
    locationName: options.locationName || `${lat},${lng}`
  });
}

module.exports = {
  buildUrl,
  dateChipFromWindow,
  mapEvent,
  queryFor,
  searchByCategory,
  searchEvents,
  searchNearbyEvents
};
