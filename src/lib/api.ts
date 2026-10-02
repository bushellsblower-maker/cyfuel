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

export const LOOKUP_TIMEOUT_MS = 15_000;
export const LOOKUP_TOO_SLOW = "Pip took too long — try again or set the tank yourself";

export async function lookupCar(car: string, signal?: AbortSignal): Promise<CarTankEstimate> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), LOOKUP_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  try {
    return await raceAbort(postJson("/api/car-tank", { car }, combined), combined);
  } catch (error) {
    if (combined.aborted || isAbortError(error)) throw new Error(LOOKUP_TOO_SLOW);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
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
