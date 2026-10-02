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

export type LookupFailureCode = "bad reply" | "too slow" | "rate limited" | "network";

export class LookupFailed extends Error {
  code: LookupFailureCode;
  constructor(message: string, code: LookupFailureCode) {
    super(message);
    this.name = "LookupFailed";
    this.code = code;
  }
}

export function lookupFailureCode(status: number | null, aborted: boolean): LookupFailureCode {
  if (aborted || status === 504) return "too slow";
  if (status === 429) return "rate limited";
  if (status == null) return "network";
  return "bad reply";
}

export async function lookupCar(car: string, signal?: AbortSignal): Promise<CarTankEstimate> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), LOOKUP_TIMEOUT_MS);
  const combined = signal ? combineSignals([signal, timeout.signal]) : timeout.signal;
  try {
    return await raceAbort(postJson("/api/car-tank", { car }, combined), combined);
  } catch (error) {
    if (combined.aborted || isAbortError(error)) throw new LookupFailed(LOOKUP_TOO_SLOW, "too slow");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const any = (AbortSignal as { any?: (inputs: AbortSignal[]) => AbortSignal }).any;
  if (typeof any === "function") return any.call(AbortSignal, signals);
  const controller = new AbortController();
  for (const input of signals) {
    if (input.aborted) {
      controller.abort();
      return controller.signal;
    }
    input.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
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
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      signal,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
    throw new LookupFailed("Pip couldn't reach the brochure. The tank slider still works.", "network");
  }
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !payload) {
    throw new LookupFailed(
      payload?.error || "Pip dropped the brochure. The tank slider still works.",
      lookupFailureCode(response.status, false),
    );
  }
  return payload;
}
