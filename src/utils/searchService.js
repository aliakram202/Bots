// Search service - core API for event and venue discovery

const eventsData = require("../data/events.json");
const venuesData = require("../data/venues.json");
const { config } = require("../config");
const serpApiProvider = require("../providers/serpApiProvider");
const ticketmasterProvider = require("../providers/ticketmasterProvider");
const { toTicketmasterDateTime } = require("./stayPeriod");

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
async function firstProviderResult(searches, fallbackSearch) {
  for (const search of searches) {
    if (!search.enabled) continue;

    try {
      const results = await search.run();
      if (results.length > 0) return results;
    } catch (error) {
      console.warn(`${search.name} event search failed; trying next provider: ${error.message}`);
    }
  }

  return fallbackSearch();
}

function applyFilters(events, options = {}) {
  return events.filter(event => {
    if (options.category && event.category !== options.category) return false;
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
    if (options.dateWindow && event.startDate) {
      const eventDate = new Date(event.startDate);
      if (Number.isNaN(eventDate.getTime())) return true;
      if (eventDate < options.dateWindow.start || eventDate > options.dateWindow.end) return false;
    }
    return true;
  }).map(event => {
    if (options.dateWindow && !event.startDate && !event.source) {
      return { ...event, source: "local fallback data" };
    }
    return event;
  });
}

function providerOptions(options = {}) {
  return {
    countryCode: config.ticketmasterCountryCode,
    townName: options.townName,
    category: options.category,
    startDateTime: options.dateWindow ? toTicketmasterDateTime(options.dateWindow.start) : undefined,
    endDateTime: options.dateWindow ? toTicketmasterDateTime(options.dateWindow.end) : undefined
  };
}

function liveProviderSearches(category, options, ticketmasterSearch) {
  const providerOpts = providerOptions(options);

  return [
    {
      name: "SerpApi",
      enabled: Boolean(config.serpApiKey),
      run: async () => applyFilters(
        await serpApiProvider.searchByCategory(config.serpApiKey, category, providerOpts),
        options
      )
    },
    {
      name: "Ticketmaster",
      enabled: Boolean(config.ticketmasterApiKey),
      run: async () => applyFilters(await ticketmasterSearch(providerOpts), options)
    }
  ];
}

function localSearchByCategory(category) {
  return eventsData.filter(e => e.category === category);
}

async function searchByCategory(category, options = {}) {
  return firstProviderResult(
    liveProviderSearches(category, options, providerOpts =>
      ticketmasterProvider.searchByCategory(config.ticketmasterApiKey, category, providerOpts)
    ),
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
  const providerOpts = providerOptions(options);
  return firstProviderResult(
    [
      {
        name: "SerpApi",
        enabled: Boolean(config.serpApiKey),
        run: async () => applyFilters(
          await serpApiProvider.searchNearbyEvents(config.serpApiKey, lat, lng, radiusKm, providerOpts),
          options
        )
      },
      {
        name: "Ticketmaster",
        enabled: Boolean(config.ticketmasterApiKey),
        run: async () => applyFilters(
          await ticketmasterProvider.searchNearbyEvents(config.ticketmasterApiKey, lat, lng, radiusKm, providerOpts),
          options
        )
      }
    ],
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
  const providerOpts = providerOptions(options);
  return firstProviderResult(
    [
      {
        name: "SerpApi",
        enabled: Boolean(config.serpApiKey),
        run: async () => applyFilters(
          await serpApiProvider.searchEvents(config.serpApiKey, query, providerOpts),
          options
        )
      },
      {
        name: "Ticketmaster",
        enabled: Boolean(config.ticketmasterApiKey),
        run: async () => applyFilters(
          await ticketmasterProvider.searchEvents(config.ticketmasterApiKey, query, providerOpts),
          options
        )
      }
    ],
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

function searchVenueFallback(options = {}) {
  if (options.lat && options.lng) {
    return searchNearbyVenues(options.lat, options.lng, options.radiusKm || 20);
  }

  const placeQueries = [options.townName, options.locationName]
    .filter(Boolean)
    .map(value => String(value).toLowerCase());
  const categoryQuery = options.category ? String(options.category).toLowerCase() : "";

  if (placeQueries.length === 0 && !categoryQuery) return [];

  return venuesData.filter(venue => {
    const haystack = [
      venue.name,
      venue.description,
      venue.region,
      venue.website
    ].filter(Boolean).join(" ").toLowerCase();

    if (placeQueries.length > 0) {
      return placeQueries.some(query => haystack.includes(query));
    }

    return haystack.includes(categoryQuery);
  });
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
  searchVenueFallback,
  search
};
