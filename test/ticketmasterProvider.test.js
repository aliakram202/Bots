const assert = require("node:assert/strict");
const test = require("node:test");

const { mapEvent } = require("../src/providers/ticketmasterProvider");

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
  assert.equal(mapped.source, "ticketmaster");
});

test("drops Ticketmaster events without coordinates", () => {
  const mapped = mapEvent({ id: "missing-location", name: "No location" });

  assert.equal(mapped, null);
});
