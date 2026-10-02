import { regionsNear, type RegionId } from "../shared/coverage";
import { haversineKm } from "../shared/geo";
import { normalizePrices, normalizeRates } from "../shared/normalize";
import { fuelWideSlug, stationFromFuelWide, stationFromUk } from "../shared/stations";
import type { Station, StationsPayload } from "../shared/types";
import { APP_VERSION } from "../shared/version";

const USER_AGENT = "cyfuel/1.0 (+https://cyfuel.cybush.uk)";
const OPEN_VAN = "https://openvan.camp";

const ATTRIBUTION = {
  GB: "United Kingdom station prices: UK Government Fuel Finder, Open Government Licence v3.0, via FuelCosts.co.uk. Mis-plotted pins are nudged with ONS postcodes via postcodes.io (Open Government Licence).",
  FR: "Station prices: prix-carburants.gouv.fr, Licence Ouverte, via FuelWide",
  ES: "Station prices: Ministerio para la Transición Ecológica y el Reto Demográfico, via FuelWide",
  IT: "Station prices: MIMIT, CC BY 4.0, via FuelWide",
  AU: "Station prices: FuelWatch, Government of Western Australia, CC BY 4.0, via FuelWide",
} as const;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 404 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== "GET") {
      return json({ error: "The nozzle only pours GET requests." }, 405, 0);
    }

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, version: env.APP_VERSION || APP_VERSION }, 200, 60);
      }
      if (url.pathname === "/api/prices") {
        return cached(request, ctx, 6 * 60 * 60, loadPrices);
      }
      if (url.pathname === "/api/rates") {
        return cached(request, ctx, 6 * 60 * 60, loadRates);
      }
      if (url.pathname === "/api/stations") {
        const lat = numberParam(url, "lat");
        const lon = numberParam(url, "lon");
        if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return json({ error: "I need a real lat and lon. The map is not a suggestion." }, 400, 0);
        }
        const radiusKm = clamp(numberParam(url, "radiusKm") ?? 12, 1, 80);
        return cached(request, ctx, 15 * 60, () => loadStations(lat, lon, radiusKm));
      }
      return json({ error: "That path is not a pump." }, 404, 0);
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "api_error",
          path: url.pathname,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return json({ error: "The pumps hiccuped. Try again in a moment." }, 502, 0);
    }
  },
} satisfies ExportedHandler<Env>;

async function loadPrices(): Promise<unknown> {
  const payload = await fetchJson(`${OPEN_VAN}/api/fuel/prices?source=cyfuel.cybush.uk`);
  return normalizePrices(payload);
}

async function loadRates(): Promise<unknown> {
  const payload = await fetchJson(`${OPEN_VAN}/api/currency/rates?source=cyfuel.cybush.uk`);
  return normalizeRates(payload);
}

async function loadStations(lat: number, lon: number, radiusKm: number): Promise<StationsPayload> {
  const regions = regionsNear(lat, lon, radiusKm);
  const batches = await Promise.all(regions.map((region) => loadRegion(region, lat, lon, radiusKm)));
  let stations = batches.flatMap((batch) => batch.stations);
  const attributions = batches.flatMap((batch) => batch.attributions);
  if (regions.includes("GB")) {
    stations = await snapUkPins(stations);
  }
  const origin = { lat, lon };
  stations = stations
    .filter((station) => haversineKm(origin, station) <= radiusKm * 1.15)
    .sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b))
    .slice(0, 100);

  const note =
    stations.length > 0
      ? null
      : regions.length > 0
        ? "No open-data pumps showed up in this radius. Widen the search, or treat the country colour as an average — not a nozzle."
        : "No open station feed covers this spot yet. The country colour is a national average. We're still hunting local pumps here.";

  return { stations, regions, attributions, radiusKm, note };
}

async function loadRegion(
  region: RegionId,
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<{ stations: Station[]; attributions: string[] }> {
  try {
    if (region === "GB") return await loadUk(lat, lon, radiusKm);
    return await loadFuelWide(region, lat, lon, radiusKm);
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "region_failed",
        region,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return { stations: [], attributions: [] };
  }
}

async function loadFuelWide(
  region: "FR" | "ES" | "IT" | "AU",
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<{ stations: Station[]; attributions: string[] }> {
  const km = Math.min(80, Math.max(1, Math.round(radiusKm)));
  const url = `https://fuelwide.com/api/stations/${fuelWideSlug(region)}?near=${lat.toFixed(4)},${lon.toFixed(4)}&km=${km}&limit=120`;
  const payload = await fetchJson(url);
  const body = asRecord(payload);
  const attribution =
    (typeof body?.attribution === "string" && body.attribution) || ATTRIBUTION[region];
  const currency = typeof body?.currency === "string" && body.currency ? body.currency : region === "AU" ? "AUD" : "EUR";
  const rows = Array.isArray(body?.stations) ? body.stations : [];
  const stations = rows
    .map((row) => stationFromFuelWide(region, row, attribution, currency))
    .filter((station): station is Station => station != null);
  return { stations, attributions: [attribution] };
}

async function loadUk(
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<{ stations: Station[]; attributions: string[] }> {
  const miles = Math.min(50, Math.max(1, radiusKm / 1.609344));
  const url = `https://fuelcosts.co.uk/api/stations?lat=${lat}&lon=${lon}&radius=${miles.toFixed(2)}&sort=distance&perPage=80`;
  const payload = await fetchJson(url);
  const body = asRecord(payload);
  const rows = Array.isArray(body?.stations) ? body.stations : [];
  const stations = rows
    .map((row) => stationFromUk(row, ATTRIBUTION.GB))
    .filter((station): station is Station => station != null);
  return { stations, attributions: [ATTRIBUTION.GB] };
}

/**
 * FuelCosts occasionally stores a pin far from the station's own postcode.
 * When the drift is more than 20 km, trust the postcode centroid instead.
 */
async function snapUkPins(stations: Station[]): Promise<Station[]> {
  const uk = stations.filter((station) => station.country === "GB");
  const postcodes = [
    ...new Set(
      uk
        .map((station) => station.address.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i)?.[0] ?? null)
        .filter((code): code is string => Boolean(code))
        .map((code) => code.replace(/\s+/g, "").toUpperCase()),
    ),
  ].slice(0, 100);
  if (!postcodes.length) return stations;
  try {
    const response = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ postcodes }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return stations;
    const payload = (await response.json()) as {
      result?: Array<{ query?: string; result?: { latitude?: number; longitude?: number } | null }>;
    };
    const lookup = new Map<string, { lat: number; lon: number }>();
    for (const row of payload.result ?? []) {
      const lat = row.result?.latitude;
      const lon = row.result?.longitude;
      if (!row.query || lat == null || lon == null) continue;
      lookup.set(row.query.replace(/\s+/g, "").toUpperCase(), { lat, lon });
    }
    return stations.map((station) => {
      if (station.country !== "GB") return station;
      const match = station.address.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i);
      if (!match) return station;
      const fixed = lookup.get(match[0].replace(/\s+/g, "").toUpperCase());
      if (!fixed) return station;
      if (haversineKm(station, fixed) <= 20) return station;
      return { ...station, lat: fixed.lat, lon: fixed.lon };
    });
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "postcode_snap_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return stations;
  }
}

async function cached(
  request: Request,
  ctx: ExecutionContext,
  ttlSeconds: number,
  loader: () => Promise<unknown>,
): Promise<Response> {
  const key = new Request(request.url, { method: "GET" });
  const cache = caches.default;
  try {
    const hit = await cache.match(key);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("X-Cyfuel-Cache", "HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  } catch (error) {
    console.log(JSON.stringify({ event: "cache_match_failed", message: String(error) }));
  }

  const response = json(await loader(), 200, ttlSeconds);
  response.headers.set("X-Cyfuel-Cache", "MISS");
  ctx.waitUntil(
    cache.put(key, response.clone()).catch((error: unknown) => {
      console.log(JSON.stringify({ event: "cache_put_failed", message: String(error) }));
    }),
  );
  return response;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error(`Upstream ${response.status} for ${new URL(url).host}${new URL(url).pathname}`);
  }
  return response.json();
}

function json(data: unknown, status: number, ttlSeconds: number): Response {
  const headers = corsHeaders();
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", ttlSeconds > 0 ? `public, max-age=${ttlSeconds}` : "no-store");
  return new Response(JSON.stringify(data), { status, headers });
}

function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
}

function numberParam(url: URL, name: string): number | null {
  const raw = url.searchParams.get(name);
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
