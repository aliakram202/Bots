// Search service - core API for event and venue discovery

const eventsData = require("../data/events.json");
const venuesData = require("../data/venues.json");
const { config } = require("../config");
const ticketmasterProvider = require("../providers/ticketmasterProvider");

/**
 * Haversine formula to calculate distance between two coordinates
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Searches events by category
 */
async function withLiveFallback(liveSearch, fallbackSearch) {
  if (!config.ticketmasterApiKey) {
    return fallbackSearch();
  }

  try {
    const liveResults = await liveSearch();
    return liveResults.length > 0 ? liveResults : fallbackSearch();
  } catch (error) {
    console.warn(`Live event search failed; using local fallback: ${error.message}`);
    return fallbackSearch();
  }
}

function applyFilters(events, options = {}) {
  return events.filter(event => {
    if (options.freeOnly && event.free !== true) return false;
    if (options.ticketedOnly && !event.ticket_link) return false;
    if (options.locationName) {
      const haystack = [
        event.name,
        event.description,
        event.region,
        event.website,
        event.ticket_link
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(options.locationName.toLowerCase())) return false;
    }
    return true;
  });
}

function localSearchByCategory(category) {
  return eventsData.filter(e => e.category === category);
}

async function searchByCategory(category, options = {}) {
  return withLiveFallback(
    async () => applyFilters(await ticketmasterProvider.searchByCategory(config.ticketmasterApiKey, category, {
      countryCode: config.ticketmasterCountryCode
    }), options),
    () => applyFilters(localSearchByCategory(category), options)
  );
}

/**
 * Searches events by free/paid status
 */
async function searchFreeEvents() {
  return eventsData.filter(e => e.free === true);
}

/**
 * Searches events with ticket links
 */
async function searchTicketedEvents() {
  return eventsData.filter(e => e.ticket_link);
}

/**
 * Searches nearby events by location (within 100km)
 */
function localSearchNearbyEvents(lat, lng, radiusKm = 100) {
  return eventsData
    .map(event => ({
      ...event,
      distance: calculateDistance(lat, lng, event.location.lat, event.location.lng)
    }))
    .filter(e => e.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

async function searchNearbyEvents(lat, lng, radiusKm = 100, options = {}) {
  return withLiveFallback(
    async () => applyFilters(await ticketmasterProvider.searchNearbyEvents(config.ticketmasterApiKey, lat, lng, radiusKm, {
      countryCode: config.ticketmasterCountryCode
    }), options),
    () => applyFilters(localSearchNearbyEvents(lat, lng, radiusKm), options)
  );
}

/**
 * Searches venues by nearby location (within 100km)
 */
function searchNearbyVenues(lat, lng, radiusKm = 100) {
  return venuesData
    .map(venue => ({
      ...venue,
      distance: calculateDistance(lat, lng, venue.location.lat, venue.location.lng)
    }))
    .filter(v => v.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Full-text search across events
 */
function localSearchEvents(query, options = {}) {
  const lower = query.toLowerCase();
  return applyFilters(eventsData.filter(
    e =>
      e.name.toLowerCase().includes(lower) ||
      e.description.toLowerCase().includes(lower) ||
      e.category.toLowerCase().includes(lower)
  ), options);
}

async function searchEvents(query, options = {}) {
  return withLiveFallback(
    async () => applyFilters(await ticketmasterProvider.searchEvents(config.ticketmasterApiKey, query, {
      countryCode: config.ticketmasterCountryCode
    }), options),
    () => localSearchEvents(query, options)
  );
}

/**
 * Full-text search across venues
 */
function searchVenues(query) {
  const lower = query.toLowerCase();
  return venuesData.filter(
    v =>
      v.name.toLowerCase().includes(lower) ||
      v.description.toLowerCase().includes(lower)
  );
}

/**
 * Route to appropriate search based on intent and parameters
 */
async function search(intent, query, options = {}) {
  const { lat, lng } = options;

  // Location-based search
  if (lat && lng) {
    if (intent === "nearby") {
      return searchNearbyEvents(lat, lng, options.radiusKm || 100, options);
    }
  }

  // Category search
  if (intent === "art") return searchByCategory("art", options);
  if (intent === "museum") return searchByCategory("museum", options);
  if (intent === "workshop") return searchByCategory("workshop", options);
  if (intent === "festival") return searchByCategory("festival", options);
  if (intent === "photography") return searchByCategory("photography", options);
  if (intent === "cinema") return searchByCategory("cinema", options);
  if (intent === "theatre") return searchByCategory("theatre", options);
  if (intent === "books") return searchByCategory("books", options);

  // Special searches
  if (intent === "free") return searchFreeEvents();
  if (intent === "tickets") return searchTicketedEvents();

  // Full-text search fallback
  return searchEvents(query, options);
}

module.exports = {
  calculateDistance,
  applyFilters,
  localSearchByCategory,
  searchByCategory,
  searchFreeEvents,
  searchTicketedEvents,
  searchNearbyEvents,
  localSearchNearbyEvents,
  searchNearbyVenues,
  searchEvents,
  localSearchEvents,
  searchVenues,
  search
};
