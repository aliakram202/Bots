const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function nextWeekendRange(now) {
  const start = startOfDay(now);
  const day = start.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const saturday = addDays(start, daysUntilSaturday);
  return {
    start: saturday,
    end: endOfDay(addDays(saturday, 1))
  };
}

function buildWindow(days, label, now) {
  const start = new Date(now);
  return {
    start,
    end: endOfDay(addDays(startOfDay(now), Math.max(days - 1, 0))),
    label,
    fallbackUsed: false
  };
}

function parseStayPeriod(text, now = new Date()) {
  const value = String(text || "").trim().toLowerCase();
  const normalized = value.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

  if (["today", "tonight"].includes(normalized)) {
    return {
      start: new Date(now),
      end: endOfDay(now),
      label: "today",
      fallbackUsed: false
    };
  }

  if (normalized === "tomorrow") {
    const tomorrow = addDays(startOfDay(now), 1);
    return {
      start: tomorrow,
      end: endOfDay(tomorrow),
      label: "tomorrow",
      fallbackUsed: false
    };
  }

  if (normalized.includes("weekend")) {
    const range = nextWeekendRange(now);
    return {
      ...range,
      label: "this weekend",
      fallbackUsed: false
    };
  }

  const match = normalized.match(/(\d+)\s*(days|day|weeks|week|months|month)/);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    const days = unit.startsWith("day") ? amount : unit.startsWith("week") ? amount * 7 : amount * 30;
    return buildWindow(Math.max(days, 1), `${amount} ${unit}`, now);
  }

  return {
    ...buildWindow(7, "7 days", now),
    fallbackUsed: true
  };
}

function toTicketmasterDateTime(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

module.exports = {
  addDays,
  parseStayPeriod,
  toTicketmasterDateTime
};
