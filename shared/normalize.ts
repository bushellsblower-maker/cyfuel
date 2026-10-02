import { asUnit, perLitre, pickGrade } from "./fuels";
import type { CountryGrade, CountryPrice, FuelId, PricesPayload } from "./types";
import { FUEL_IDS } from "./fuelIds";

type RawCountry = {
  country_code?: string;
  country_name?: string;
  region?: string | null;
  currency?: string;
  local_currency?: string;
  unit?: string;
  units?: Record<string, string>;
  currencies?: Record<string, string>;
  prices?: Record<string, unknown>;
  fetched_at?: string | null;
  sources?: unknown;
};

const OPEN_VAN_ATTRIBUTION =
  "Country fuel prices and exchange rates: OpenVan.camp (CC BY 4.0)";

export function normalizePrices(payload: unknown): PricesPayload {
  const body = asRecord(payload);
  const data = asRecord(body?.data);
  const meta = asRecord(body?.meta);
  const countries: CountryPrice[] = [];
  if (data) {
    for (const [code, value] of Object.entries(data)) {
      const country = normalizeCountry(code, value);
      if (country) countries.push(country);
    }
  }
  countries.sort((a, b) => a.name.localeCompare(b.name));
  return {
    countries,
    updatedAt: typeof meta?.updated_at === "string" ? meta.updated_at : null,
    attribution: OPEN_VAN_ATTRIBUTION,
  };
}

export function normalizeRates(payload: unknown): {
  base: "EUR";
  rates: Record<string, number>;
  updatedAt: string | null;
  attribution: string;
} {
  const body = asRecord(payload);
  const rawRates = asRecord(body?.rates);
  const meta = asRecord(body?.meta);
  const rates: Record<string, number> = { EUR: 1 };
  if (rawRates) {
    for (const [code, value] of Object.entries(rawRates)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        rates[code] = value;
      }
    }
  }
  return {
    base: "EUR",
    rates,
    updatedAt: typeof meta?.updated_at === "string" ? meta.updated_at : null,
    attribution: OPEN_VAN_ATTRIBUTION,
  };
}

function normalizeCountry(fallbackCode: string, value: unknown): CountryPrice | null {
  const raw = asRecord(value) as RawCountry | null;
  if (!raw) return null;
  const code = (raw.country_code || fallbackCode).toUpperCase();
  const currency = raw.currency || raw.local_currency || "EUR";
  const grades: Partial<Record<FuelId, CountryGrade>> = {};
  for (const fuel of FUEL_IDS) {
    const published = pickGrade(raw.prices, fuel);
    if (published == null) continue;
    const key = gradeKeyUsed(raw.prices, fuel);
    const unit = asUnit((key ? raw.units?.[key] : undefined) || raw.unit);
    const gradeCurrency = (key && raw.currencies?.[key]) || currency;
    grades[fuel] = {
      published,
      perLitre: perLitre(published, unit),
      unit,
      currency: gradeCurrency,
    };
  }
  const sources = Array.isArray(raw.sources)
    ? raw.sources.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
  return {
    code,
    name: raw.country_name || code,
    region: raw.region ?? null,
    currency,
    fetchedAt: raw.fetched_at ?? null,
    sources,
    grades,
  };
}

function gradeKeyUsed(
  prices: Record<string, unknown> | undefined,
  fuel: FuelId,
): string | null {
  if (!prices) return null;
  const keys =
    fuel === "petrol"
      ? ["gasoline", "gasoline_regular"]
      : fuel === "premium"
        ? ["gasoline_premium", "gasoline_super", "premium"]
        : fuel === "diesel"
          ? ["diesel", "diesel_regular"]
          : fuel === "dieselPlus"
            ? ["diesel_premium"]
            : ["lpg"];
  for (const key of keys) {
    const raw = prices[key];
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return key;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
