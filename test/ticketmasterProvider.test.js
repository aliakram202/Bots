const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildUrl,
  mapEvent,
  searchNearbyEvents
} = require("../src/providers/ticketmasterProvider");

test("maps Ticketmaster event data into internal event shape", () => {
  const mapped = mapEvent({
    id: "abc123",
    name: "Baghdad Photography Festival",
    url: "https://ticketmaster.example/events/abc123",
    dates: {
      start: {
        localDate: "2026-06-01",
        localTime: "19:30:00"
      }
    },
    classifications: [
      {
        segment: { name: "Arts & Theatre" },
        genre: { name: "Photography" }
      }
    ],
    _embedded: {
      venues: [
        {
          name: "National Theatre",
          city: { name: "Baghdad" },
          country: { countryCode: "IQ" },
          location: {
            latitude: "33.3152",
            longitude: "44.3661"
          }
        }
      ]
    }
  });

  assert.equal(mapped.id, "ticketmaster-abc123");
  assert.equal(mapped.category, "photography");
  assert.equal(mapped.region, "arab");
  assert.deepEqual(mapped.location, { lat: 33.3152, lng: 44.3661 });
  assert.equal(mapped.venueName, "National Theatre");
  assert.equal(mapped.cityName, "Baghdad");
  assert.equal(mapped.countryCode, "IQ");
  assert.equal(mapped.startDate, "2026-06-01");
  assert.equal(mapped.source, "ticketmaster");
});

test("builds Ticketmaster city and date window query parameters", () => {
  const url = buildUrl("key123", {
    keyword: "museum exhibition",
    city: "Braunschweig",
    startDateTime: "2026-05-12T00:00:00Z",
    endDateTime: "2026-05-19T23:59:59Z"
  });

  assert.equal(url.searchParams.get("city"), "Braunschweig");
  assert.equal(url.searchParams.get("startDateTime"), "2026-05-12T00:00:00Z");
  assert.equal(url.searchParams.get("endDateTime"), "2026-05-19T23:59:59Z");
});

test("drops Ticketmaster events without coordinates", () => {
  const mapped = mapEvent({ id: "missing-location", name: "No location" });

  assert.equal(mapped, null);
});

test("builds Ticketmaster URLs with expected query parameters", () => {
  const url = buildUrl("key123", {
    geoPoint: "smnfdr72h",
    radius: 20,
    unit: "km",
    sort: "distance,asc"
  });

  assert.equal(url.searchParams.get("apikey"), "key123");
  assert.equal(url.searchParams.get("geoPoint"), "smnfdr72h");
  assert.equal(url.searchParams.get("radius"), "20");
  assert.equal(url.searchParams.get("unit"), "km");
  assert.equal(url.searchParams.get("sort"), "distance,asc");
});

test("nearby Ticketmaster search uses geoPoint instead of latlong", async () => {
  const originalFetch = global.fetch;
  let requestedUrl;

  global.fetch = async url => {
    requestedUrl = url;
    return {
      ok: true,
      async json() {
        return { _embedded: { events: [] } };
      }
    };
  };

  try {
    await searchNearbyEvents("key123", 33.3152, 44.3661, 20);

    assert.equal(requestedUrl.searchParams.has("geoPoint"), true);
    assert.equal(requestedUrl.searchParams.has("latlong"), false);
    assert.equal(requestedUrl.searchParams.get("radius"), "20");
    assert.equal(requestedUrl.searchParams.get("unit"), "km");
  } finally {
    global.fetch = originalFetch;
  }
});
