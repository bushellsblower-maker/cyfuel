import { useEffect, useMemo, useState } from "react";
import type { FuelId } from "../../shared/types";

export type Settings = {
  tankLitres: number;
  litresPer100km: number;
  roundTrip: boolean;
  radiusKm: number;
  /** "standing" ranks in the currency of the country under the pin. */
  compareCurrency: string;
};

export const DEFAULT_SETTINGS: Settings = {
  tankLitres: 50,
  litresPer100km: 7,
  roundTrip: false,
  radiusKm: 12,
  compareCurrency: "standing",
};

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
      radiusKm: saved.radiusKm,
      compareCurrency: saved.compareCurrency,
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

function sanitize(value: Saved): Saved {
  const fuels: FuelId[] = ["petrol", "premium", "diesel", "dieselPlus", "lpg"];
  return {
    tankLitres: clamp(value.tankLitres, 10, 150),
    litresPer100km: clamp(value.litresPer100km, 2, 25),
    roundTrip: Boolean(value.roundTrip),
    radiusKm: clamp(value.radiusKm, 2, 80),
    compareCurrency:
      value.compareCurrency === "standing" || /^[A-Z]{3}$/.test(value.compareCurrency)
        ? value.compareCurrency
        : "standing",
    fuel: fuels.includes(value.fuel) ? value.fuel : "petrol",
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
