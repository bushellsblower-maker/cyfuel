import type { CarTankEstimate } from "../../shared/carTank";
import type { PricesPayload, RatesPayload, StationsPayload } from "../../shared/types";

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: "application/json" } });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) {
    throw new Error(body?.error || "The pumps went quiet. Try again in a moment.");
  }
  return body;
}

export function getPrices(signal?: AbortSignal): Promise<PricesPayload> {
  return getJson("/api/prices", signal);
}

export function getRates(signal?: AbortSignal): Promise<RatesPayload> {
  return getJson("/api/rates", signal);
}

export function getStations(
  lat: number,
  lon: number,
  radiusKm: number,
  signal?: AbortSignal,
): Promise<StationsPayload> {
  const query = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
    radiusKm: String(Math.round(radiusKm)),
  });
  return getJson(`/api/stations?${query.toString()}`, signal);
}

export function lookupCar(car: string, signal?: AbortSignal): Promise<CarTankEstimate> {
  return postJson("/api/car-tank", { car }, signal);
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    signal,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error || "Pip dropped the brochure. The tank slider still works.");
  }
  return payload;
}
