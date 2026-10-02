import { useEffect, useMemo, useState } from "react";
import type { FuelId } from "../../shared/types";
import type { UnitSystem } from "../../shared/units";

export const SCOPES = [
  { id: "5", label: "5 km" },
  { id: "15", label: "15 km" },
  { id: "50", label: "50 km" },
  { id: "country", label: "Country" },
  { id: "world", label: "World" },
] as const;

export type Scope = (typeof SCOPES)[number]["id"];

export type Settings = {
  tankLitres: number;
  litresPer100km: number;
  roundTrip: boolean;
  /** 5 / 15 / 50 km around the pin, the country under it, or the whole world. */
  scope: Scope;
  /** Green-to-red price paint. Off uses one cartoon colour. */
  colourByPrice: boolean;
  /** "standing" ranks in the currency of the country under the pin. */
  compareCurrency: string;
  /** Display units. Ranking still uses litres and L/100km. Imperial means UK gallons and UK mpg. */
  units: UnitSystem;
};

export const DEFAULT_SETTINGS: Settings = {
  tankLitres: 50,
  litresPer100km: 7,
  roundTrip: false,
  scope: "15",
  colourByPrice: true,
  compareCurrency: "standing",
  units: "metric",
};

/** Kilometres to ask the station API for. World scope does not fetch pumps. */
export function fetchRadiusKm(scope: Scope): number | null {
  if (scope === "5" || scope === "15" || scope === "50") return Number(scope);
  if (scope === "country") return 80;
  return null;
}

const STORAGE_KEY = "cyfuel-settings-v1";

type Saved = Settings & { fuel: FuelId };

export function usePreferences(): {
  settings: Settings;
  fuel: FuelId;
  setSettings: (patch: Partial<Settings>) => void;
  setFuel: (fuel: FuelId) => void;
} {
  const [saved, setSaved] = useState<Saved>(() => load());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  const settings = useMemo<Settings>(
    () => ({
      tankLitres: saved.tankLitres,
      litresPer100km: saved.litresPer100km,
      roundTrip: saved.roundTrip,
      scope: saved.scope,
      colourByPrice: saved.colourByPrice,
      compareCurrency: saved.compareCurrency,
      units: saved.units,
    }),
    [saved],
  );
  return {
    settings,
    fuel: saved.fuel,
    setSettings: (patch) => setSaved((current) => ({ ...current, ...sanitize({ ...current, ...patch }) })),
    setFuel: (next) => setSaved((current) => ({ ...current, fuel: next })),
  };
}

function load(): Saved {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, fuel: "petrol" };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return sanitize({ ...DEFAULT_SETTINGS, fuel: "petrol", ...parsed });
  } catch {
    return { ...DEFAULT_SETTINGS, fuel: "petrol" };
  }
}

function sanitize(value: Saved & { radiusKm?: number }): Saved {
  const fuels: FuelId[] = ["petrol", "premium", "diesel", "dieselPlus", "lpg"];
  return {
    tankLitres: clamp(value.tankLitres, 10, 150),
    litresPer100km: clamp(value.litresPer100km, 2, 25),
    roundTrip: Boolean(value.roundTrip),
    scope: normalizeScope(value.scope, value.radiusKm),
    colourByPrice: value.colourByPrice !== false,
    units: value.units === "imperial" ? "imperial" : "metric",
    compareCurrency:
      value.compareCurrency === "standing" || /^[A-Z]{3}$/.test(value.compareCurrency)
        ? value.compareCurrency
        : "standing",
    fuel: fuels.includes(value.fuel) ? value.fuel : "petrol",
  };
}

export function normalizeScope(scope: unknown, legacyRadiusKm: unknown): Scope {
  if (scope === "5" || scope === "15" || scope === "50" || scope === "country" || scope === "world") return scope;
  if (typeof legacyRadiusKm !== "number" || !Number.isFinite(legacyRadiusKm)) return "15";
  if (legacyRadiusKm <= 8) return "5";
  if (legacyRadiusKm <= 30) return "15";
  return "50";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
