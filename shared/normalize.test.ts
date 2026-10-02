import { describe, expect, it } from "vitest";
import { regionsNear } from "./coverage";
import { perLitre, ukPenceToMajor } from "./fuels";
import { normalizePrices, normalizeRates } from "./normalize";
import { stationFromFuelWide, stationFromUk } from "./stations";

describe("country prices", () => {
  it("turns a US gallon price into a per-litre figure", () => {
    const prices = normalizePrices({
      data: {
        US: {
          country_code: "US",
          country_name: "United States",
          region: "americas",
          currency: "USD",
          unit: "gallon",
          units: { gasoline: "gallon", diesel: "gallon" },
          currencies: { gasoline: "USD", diesel: "USD" },
          prices: { gasoline: 3.785411784, diesel: 4 },
          fetched_at: "2026-10-01",
          sources: ["EIA"],
        },
      },
      meta: { updated_at: "2026-10-02" },
    });
    expect(prices.countries[0]?.grades.petrol?.perLitre).toBeCloseTo(1);
    expect(prices.countries[0]?.grades.petrol?.unit).toBe("gallon");
    expect(prices.updatedAt).toBe("2026-10-02");
  });

  it("keeps litre prices as published", () => {
    expect(perLitre(1.7388, "liter")).toBeCloseTo(1.7388);
    expect(ukPenceToMajor(170.9)).toBeCloseTo(1.709);
    expect(ukPenceToMajor(1.709)).toBeCloseTo(1.709);
  });

  it("reads euro exchange rates", () => {
    const rates = normalizeRates({
      rates: { EUR: 1, GBP: 0.85, USD: 1.1, NOPE: "no" },
      meta: { updated_at: "2026-10-02T00:00:00Z" },
    });
    expect(rates.rates.GBP).toBe(0.85);
    expect(rates.rates.NOPE).toBeUndefined();
  });
});

describe("stations", () => {
  it("maps a FuelWide forecourt", () => {
    const station = stationFromFuelWide(
      "ES",
      {
        id: "3213",
        brand: "Ballenoil",
        address: "Ronda Segovia, 37",
        town: "Madrid",
        lat: 40.41,
        lon: -3.718,
        prices: { petrol95: 1.748, petrol98: 1.9, diesel: 1.899, lpg: null },
      },
      "Station prices: Ministerio para la Transición Ecológica y el Reto Demográfico",
    );
    expect(station?.prices.petrol).toBe(1.748);
    expect(station?.prices.premium).toBe(1.9);
    expect(station?.prices.lpg).toBeUndefined();
    expect(station?.currency).toBe("EUR");
    expect(station?.name).toContain("Madrid");
    const au = stationFromFuelWide(
      "AU",
      {
        id: "ampol",
        brand: "Ampol",
        name: "Ampol Foodary East Perth",
        town: "PERTH",
        lat: -31.95,
        lon: 115.87,
        prices: { petrol91: 2.36, petrol95: 2.53, petrol98: 2.63 },
      },
      "Station prices: FuelWatch, Government of Western Australia, CC BY 4.0",
      "AUD",
    );
    expect(au?.currency).toBe("AUD");
    expect(au?.prices.petrol).toBe(2.36);
    expect(au?.prices.premium).toBe(2.63);
    expect(au?.name).toBe("Ampol Foodary East Perth");
  });

  it("maps UK pence into pounds and skips closed sites", () => {
    const station = stationFromUk(
      {
        node_id: "abc",
        name: "Vauxhall Bridge",
        brand: "BP",
        lat: 51.49,
        lon: -0.13,
        address: { street: "Vauxhall Bridge Road", town: "Westminster", postcode: "SW1V 2RE" },
        prices: [
          { fuel_type: "E10", price: 179.9, price_last_updated: "2026-10-01T00:00:00Z" },
          { fuel_type: "B7_STANDARD", price: 204.9, price_last_updated: "2026-10-02T00:00:00Z" },
        ],
      },
      "UK Government Fuel Finder, Open Government Licence v3.0, via FuelCosts.co.uk",
    );
    expect(station?.prices.petrol).toBeCloseTo(1.799);
    expect(station?.prices.diesel).toBeCloseTo(2.049);
    expect(station?.updatedAt).toBe("2026-10-02T00:00:00Z");
    expect(
      stationFromUk({ is_permanently_closed: true, lat: 1, lon: 1, prices: [] }, "x"),
    ).toBeNull();
  });
});

describe("coverage", () => {
  it("picks the open station feeds near a point", () => {
    expect(regionsNear(51.5074, -0.1278, 12)).toEqual(["GB"]);
    expect(regionsNear(48.8566, 2.3522, 12)).toEqual(["FR"]);
    expect(regionsNear(40.4168, -3.7038, 12)).toEqual(["ES"]);
    expect(regionsNear(41.9028, 12.4964, 12)).toEqual(["IT"]);
    expect(regionsNear(-31.9523, 115.8613, 12)).toEqual(["AU"]);
    expect(regionsNear(-33.8688, 151.2093, 20)).toEqual([]);
    expect(regionsNear(52.52, 13.405, 15)).toEqual([]);
    expect(regionsNear(51.129, 1.313, 40).sort()).toEqual(["FR", "GB"]);
  });
});
