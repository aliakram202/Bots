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

/**
 * Formats a single event into text lines
 */
function _eventLines(event) {
  const icon = categoryIcon(event.category);
  const lines = [];
  lines.push(`${icon} *${event.name}*`);
  if (event.description) {
    lines.push(`   ${event.description}`);
  }
  lines.push(`   📍 ${event.location.lat.toFixed(4)}, ${event.location.lng.toFixed(4)}`);
  lines.push(`   🕐 ${event.opening_times}`);
  if (event.free) {
    lines.push(`   💚 FREE`);
  }
  if (event.website) {
    lines.push(`   🔗 ${event.website}`);
  }
  if (event.ticket_link) {
    lines.push(`   🎫 ${event.ticket_link}`);
  }
  return lines;
}

/**
 * Formats a single venue into text lines
 */
function _venueLines(venue) {
  const lines = [];
  lines.push(`📍 *${venue.name}*`);
  if (venue.description) {
    lines.push(`   ${venue.description}`);
  }
  lines.push(`   📍 ${venue.location.lat.toFixed(4)}, ${venue.location.lng.toFixed(4)}`);
  if (venue.website) {
    lines.push(`   🔗 ${venue.website}`);
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

  const lines = [`🎨 *${title}* (${events.length})\n`];

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

  const lines = [`📍 *${title}* (${venues.length})\n`];

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

  const lines = [`🎨 *${title}*\n`];

  // Arab section (prioritized)
  if (arab.length > 0) {
    lines.push("🌟 *Iraqi & Arab* 🌟\n");
    arab.forEach(event => {
      lines.push(..._eventLines(event));
      lines.push("");
    });
  }

  // International section
  if (international.length > 0) {
    lines.push("\n🌍 *International*\n");
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

  const lines = [`📍 *${title}*\n`];

  // Arab section (prioritized)
  if (arab.length > 0) {
    lines.push("🌟 *Iraqi & Arab* 🌟\n");
    arab.forEach(venue => {
      lines.push(..._venueLines(venue));
      lines.push("");
    });
  }

  // International section
  if (international.length > 0) {
    lines.push("\n🌍 *International*\n");
    international.forEach(venue => {
      lines.push(..._venueLines(venue));
      lines.push("");
    });
  }

  return lines.join("\n");
}

module.exports = {
  categoryIcon,
  formatEventsList,
  formatVenuesList,
  formatEventsGrouped,
  formatVenuesGrouped
};
