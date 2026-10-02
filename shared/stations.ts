import { pickGrade, ukPenceToMajor } from "./fuels";
import type { FuelId, Station } from "./types";
import { FUEL_IDS } from "./fuelIds";

const FUELWIDE_SLUG: Record<"FR" | "ES" | "IT" | "AU", string> = {
  FR: "france",
  ES: "spain",
  IT: "italy",
  AU: "australia",
};

export function fuelWideSlug(country: "FR" | "ES" | "IT" | "AU"): string {
  return FUELWIDE_SLUG[country];
}

export function stationFromFuelWide(
  country: "FR" | "ES" | "IT" | "AU",
  raw: unknown,
  attribution: string,
  currency = "EUR",
): Station | null {
  const row = asRecord(raw);
  if (!row) return null;
  const lat = asNumber(row.lat);
  const lon = asNumber(row.lon);
  if (lat == null || lon == null) return null;
  const prices = gradeMap(asRecord(row.prices), (value) => value);
  if (!prices) return null;
  const town = text(row.town);
  const brand = text(row.brand) || text(row.name) || "Forecourt";
  const address = [text(row.address), town, text(row.province), text(row.postcode)]
    .filter(Boolean)
    .join(", ");
  const name = text(row.name) || (town && text(row.brand) ? `${text(row.brand)} · ${town}` : town ? `${brand} · ${town}` : brand);
  return {
    id: `fw:${country}:${text(row.id) || `${lat},${lon}`}`,
    name,
    brand,
    lat,
    lon,
    address,
    currency,
    prices,
    updatedAt: null,
    source: "fuelwide",
    country,
    attribution,
  };
}

export function stationFromUk(raw: unknown, attribution: string): Station | null {
  const row = asRecord(raw);
  if (!row) return null;
  if (row.is_permanently_closed === true || row.is_temporarily_closed === true) return null;
  const lat = asNumber(row.lat);
  const lon = asNumber(row.lon);
  if (lat == null || lon == null) return null;
  const priceRows = Array.isArray(row.prices) ? row.prices : [];
  const bag: Record<string, number> = {};
  let updatedAt: string | null = null;
  for (const item of priceRows) {
    const price = asRecord(item);
    if (!price) continue;
    const fuel = text(price.fuel_type);
    const amount = asNumber(price.price);
    if (!fuel || amount == null || amount <= 0) continue;
    bag[fuel] = ukPenceToMajor(amount);
    const stamp = text(price.price_last_updated);
    if (stamp && (!updatedAt || stamp > updatedAt)) updatedAt = stamp;
  }
  const prices = gradeMap(bag, (value) => value);
  if (!prices) return null;
  const addressRecord = asRecord(row.address);
  const postcode = text(addressRecord?.postcode) || text(asRecord(row.location)?.postcode);
  const street = text(addressRecord?.street);
  const town = text(addressRecord?.town);
  const brand = text(row.brand) || text(row.brand_name) || "Pump";
  const name = text(row.name) || text(row.trading_name) || brand;
  return {
    id: `uk:${text(row.node_id) || `${lat},${lon}`}`,
    name,
    brand,
    lat,
    lon,
    address: [street, town, postcode].filter(Boolean).join(", "),
    currency: "GBP",
    prices,
    updatedAt,
    source: "fuelcosts",
    country: "GB",
    attribution,
  };
}

function gradeMap(
  prices: Record<string, unknown> | null,
  adapt: (value: number) => number,
): Partial<Record<FuelId, number>> | null {
  if (!prices) return null;
  const out: Partial<Record<FuelId, number>> = {};
  for (const fuel of FUEL_IDS) {
    const value = pickGrade(prices, fuel);
    if (value == null) continue;
    out[fuel] = adapt(value);
  }
  return Object.keys(out).length ? out : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) return null;
  return number;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
