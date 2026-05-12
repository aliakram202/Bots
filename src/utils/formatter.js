// Message formatting utilities

/**
 * Returns emoji for category
 */
function categoryIcon(category) {
  const icons = {
    museum: "🏛️",
    art: "🎨",
    workshop: "🎓",
    festival: "🎉",
    photography: "📷",
    cinema: "🎬",
    theatre: "🎭",
    books: "📚",
    venue: "📍"
  };
  return icons[category] || "✨";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function htmlLink(label, url) {
  if (!url) return "";
  return `<a href="${escapeAttribute(url)}">${escapeHtml(label)}</a>`;
}

function googleMapsUrl(location) {
  if (!location) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
}

function locationLabel(item) {
  return item.locationText || [item.venueName, item.cityName, item.countryCode].filter(Boolean).join(", ") || "Map location";
}

/**
 * Formats a single event into text lines
 */
function _eventLines(event) {
  const icon = categoryIcon(event.category);
  const lines = [];
  lines.push(`${icon} <b>${escapeHtml(event.name)}</b>`);
  const place = locationLabel(event);
  if (place) {
    lines.push(`   📍 ${escapeHtml(place)}`);
  }
  lines.push(`   🕐 ${escapeHtml(event.startDateTime || event.opening_times || "See event details")}`);
  const mapsLink = htmlLink("Open in Maps", googleMapsUrl(event.location));
  if (mapsLink) {
    lines.push(`   🗺️ ${mapsLink}`);
  }
  if (event.free) {
    lines.push(`   💚 FREE`);
  }
  if (event.website && event.website !== event.ticket_link) {
    lines.push(`   🔗 ${htmlLink("Event page", event.website)}`);
  }
  if (event.ticket_link) {
    lines.push(`   🎫 ${htmlLink("Tickets", event.ticket_link)}`);
  }
  if (event.source) {
    lines.push(`   Source: ${escapeHtml(event.source)}`);
  }
  return lines;
}

/**
 * Formats a single venue into text lines
 */
function _venueLines(venue) {
  const lines = [];
  lines.push(`📍 <b>${escapeHtml(venue.name)}</b>`);
  if (venue.description) {
    lines.push(`   ${escapeHtml(venue.description)}`);
  }
  const mapsLink = htmlLink("Open in Maps", googleMapsUrl(venue.location));
  if (mapsLink) {
    lines.push(`   🗺️ ${mapsLink}`);
  }
  if (venue.website) {
    lines.push(`   🔗 ${htmlLink("Website", venue.website)}`);
  }
  return lines;
}

/**
 * Formats events list (flat)
 */
function formatEventsList(events, title = "Events Found") {
  if (events.length === 0) {
    return "❌ No events found matching your criteria.";
  }

  const lines = [`🎨 <b>${escapeHtml(title)}</b> (${events.length})\n`];

  events.forEach(event => {
    lines.push(..._eventLines(event));
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Formats venues list (flat)
 */
function formatVenuesList(venues, title = "Venues Found") {
  if (venues.length === 0) {
    return "❌ No venues found matching your criteria.";
  }

  const lines = [`📍 <b>${escapeHtml(title)}</b> (${venues.length})\n`];

  venues.forEach(venue => {
    lines.push(..._venueLines(venue));
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Formats events grouped by region (Arab first, then International)
 */
function formatEventsGrouped(events, title = "Events Found") {
  if (events.length === 0) {
    return "❌ No events found matching your criteria.";
  }

  // Separate into arab and international
  const arab = events.filter(e => !e.region || e.region === "arab").slice(0, 5);
  const international = events.filter(e => e.region === "international").slice(0, 4);

  // If only one group has results, fall back to flat list
  if (arab.length === 0 || international.length === 0) {
    return formatEventsList(events, title);
  }

  const lines = [`🎨 <b>${escapeHtml(title)}</b>\n`];

  // Arab section (prioritized)
  if (arab.length > 0) {
    lines.push("🌟 <b>Iraqi &amp; Arab</b> 🌟\n");
    arab.forEach(event => {
      lines.push(..._eventLines(event));
      lines.push("");
    });
  }

  // International section
  if (international.length > 0) {
    lines.push("\n🌍 <b>International</b>\n");
    international.forEach(event => {
      lines.push(..._eventLines(event));
      lines.push("");
    });
  }

  return lines.join("\n");
}

/**
 * Formats venues grouped by region (Arab first, then International)
 */
function formatVenuesGrouped(venues, title = "Venues Found") {
  if (venues.length === 0) {
    return "❌ No venues found matching your criteria.";
  }

  // Separate into arab and international
  const arab = venues.filter(v => !v.region || v.region === "arab").slice(0, 5);
  const international = venues.filter(v => v.region === "international").slice(0, 4);

  // If only one group has results, fall back to flat list
  if (arab.length === 0 || international.length === 0) {
    return formatVenuesList(venues, title);
  }

  const lines = [`📍 <b>${escapeHtml(title)}</b>\n`];

  // Arab section (prioritized)
  if (arab.length > 0) {
    lines.push("🌟 <b>Iraqi &amp; Arab</b> 🌟\n");
    arab.forEach(venue => {
      lines.push(..._venueLines(venue));
      lines.push("");
    });
  }

  // International section
  if (international.length > 0) {
    lines.push("\n🌍 <b>International</b>\n");
    international.forEach(venue => {
      lines.push(..._venueLines(venue));
      lines.push("");
    });
  }

  return lines.join("\n");
}

module.exports = {
  categoryIcon,
  escapeHtml,
  googleMapsUrl,
  htmlLink,
  formatEventsList,
  formatVenuesList,
  formatEventsGrouped,
  formatVenuesGrouped
};
