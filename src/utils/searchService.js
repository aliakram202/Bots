// Search service - core API for event and venue discovery

const eventsData = require("../data/events.json");
const venuesData = require("../data/venues.json");
const { detectIntent } = require("./intentDetector");

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
function searchByCategory(category) {
  return eventsData.filter(e => e.category === category);
}

/**
 * Searches events by free/paid status
 */
function searchFreeEvents() {
  return eventsData.filter(e => e.free === true);
}

/**
 * Searches events with ticket links
 */
function searchTicketedEvents() {
  return eventsData.filter(e => e.ticket_link);
}

/**
 * Searches nearby events by location (within 100km)
 */
function searchNearbyEvents(lat, lng, radiusKm = 100) {
  return eventsData
    .map(event => ({
      ...event,
      distance: calculateDistance(lat, lng, event.location.lat, event.location.lng)
    }))
    .filter(e => e.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
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
function searchEvents(query) {
  const lower = query.toLowerCase();
  return eventsData.filter(
    e =>
      e.name.toLowerCase().includes(lower) ||
      e.description.toLowerCase().includes(lower) ||
      e.category.toLowerCase().includes(lower)
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
function search(intent, query, options = {}) {
  const { lat, lng } = options;

  // Location-based search
  if (lat && lng) {
    if (intent === "nearby") {
      return searchNearbyEvents(lat, lng);
    }
  }

  // Category search
  if (intent === "art") return searchByCategory("art");
  if (intent === "museum") return searchByCategory("museum");
  if (intent === "workshop") return searchByCategory("workshop");
  if (intent === "festival") return searchByCategory("festival");
  if (intent === "photography") return searchByCategory("photography");
  if (intent === "cinema") return searchByCategory("cinema");
  if (intent === "theatre") return searchByCategory("theatre");
  if (intent === "books") return searchByCategory("books");

  // Special searches
  if (intent === "free") return searchFreeEvents();
  if (intent === "tickets") return searchTicketedEvents();

  // Full-text search fallback
  return searchEvents(query);
}

module.exports = {
  calculateDistance,
  searchByCategory,
  searchFreeEvents,
  searchTicketedEvents,
  searchNearbyEvents,
  searchNearbyVenues,
  searchEvents,
  searchVenues,
  search
};
