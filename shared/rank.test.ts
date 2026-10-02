import { describe, expect, it } from "vitest";
import { haversineKm } from "./geo";
import { convert } from "./money";
import { costOfFill, rankStations, sortRanked } from "./rank";
import type { Station } from "./types";

const settings = { tankLitres: 50, litresPer100km: 10, roundTrip: false };

function station(partial: Partial<Station> & Pick<Station, "id" | "lat" | "lon">): Station {
  return {
    name: partial.id,
    brand: "Test",
    address: "",
    currency: "EUR",
    prices: { petrol: 2 },
    updatedAt: null,
    source: "fuelwide",
    country: "FR",
    attribution: "test",
    ...partial,
  };
}

describe("efficient fill", () => {
  it("prices the fuel burned getting there at the station's own price", () => {
    const cost = costOfFill(100, 1.5, settings);
    expect(cost.driveLitres).toBeCloseTo(10);
    expect(cost.driveCost).toBeCloseTo(15);
    expect(cost.fillCost).toBeCloseTo(75);
    expect(cost.total).toBeCloseTo(90);
  });

  it("doubles the drive when the trip home counts", () => {
    const cost = costOfFill(100, 1.5, { ...settings, roundTrip: true });
    expect(cost.driveLitres).toBeCloseTo(20);
    expect(cost.total).toBeCloseTo(105);
  });

  it("prefers a slightly dearer nearby pump over a cheap one that is a road trip", () => {
    const origin = { lat: 48.8566, lon: 2.3522 };
    const near = station({
      id: "near",
      lat: origin.lat,
      lon: origin.lon,
      prices: { petrol: 2 },
    });
    // About 100 km north, and only 10 cents cheaper: the drive costs more than the saving.
    const far = station({
      id: "far",
      lat: origin.lat + 0.9,
      lon: origin.lon,
      prices: { petrol: 1.9 },
    });
    const oneWay = rankStations([near, far], origin, "petrol", settings, { EUR: 1 }, "EUR");
    expect(sortRanked(oneWay, "efficient")[0]?.id).toBe("near");
    expect(sortRanked(oneWay, "cheapest")[0]?.id).toBe("far");
    expect(sortRanked(oneWay, "nearest")[0]?.id).toBe("near");
    expect(oneWay.find((row) => row.id === "near")?.badges).toContain("efficient");
    expect(oneWay.find((row) => row.id === "far")?.badges).toContain("cheapest");

    const bargain = station({
      id: "bargain",
      lat: origin.lat + 0.45,
      lon: origin.lon,
      prices: { petrol: 1.2 },
    });
    const worthTheDrive = rankStations(
      [near, bargain],
      origin,
      "petrol",
      settings,
      { EUR: 1 },
      "EUR",
    );
    expect(sortRanked(worthTheDrive, "efficient")[0]?.id).toBe("bargain");
  });

  it("ranks mixed currencies in the comparison currency", () => {
    const origin = { lat: 51.5, lon: -0.12 };
    const rows = rankStations(
      [
        station({
          id: "uk",
          lat: 51.5,
          lon: -0.12,
          currency: "GBP",
          country: "GB",
          source: "fuelcosts",
          prices: { petrol: 1.5 },
        }),
        station({
          id: "fr",
          lat: 51.5,
          lon: -0.1,
          currency: "EUR",
          prices: { petrol: 1.5 },
        }),
      ],
      origin,
      "petrol",
      settings,
      { EUR: 1, GBP: 0.85 },
      "EUR",
    );
    const uk = rows.find((row) => row.id === "uk");
    const fr = rows.find((row) => row.id === "fr");
    expect(uk?.unitPrice).toBeCloseTo(1.5 / 0.85);
    expect(fr?.unitPrice).toBeCloseTo(1.5);
    expect(sortRanked(rows, "cheapest")[0]?.id).toBe("fr");
  });
});

describe("geo and money", () => {
  it("measures London to Paris at roughly 340 km", () => {
    const km = haversineKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 });
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(360);
  });

  it("converts through the euro base", () => {
    expect(convert(10, "GBP", "EUR", { EUR: 1, GBP: 0.8 })).toBeCloseTo(12.5);
    expect(convert(10, "EUR", "EUR", { EUR: 1 })).toBe(10);
    expect(convert(10, "GBP", "USD", {})).toBeNull();
  });
});
