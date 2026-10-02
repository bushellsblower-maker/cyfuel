import { LITRES_PER_UNIT } from "./fuels";

const KM_PER_MILE = 1.609344;

export type UnitSystem = "metric" | "imperial";

/** Litres in one UK (imperial) gallon. US gallons are smaller and are not used here. */
export const UK_GALLON_LITRES = LITRES_PER_UNIT.imperial_gallon;

export function litresToUkGallons(litres: number): number {
  return litres / UK_GALLON_LITRES;
}

export function ukGallonsToLitres(gallons: number): number {
  return gallons * UK_GALLON_LITRES;
}

/** UK miles per imperial gallon. Higher mpg is a sipper, not a thirstier car. */
export function lPer100kmToUkMpg(litresPer100km: number): number {
  const miles = 100 / KM_PER_MILE;
  const gallons = litresPer100km / UK_GALLON_LITRES;
  return miles / gallons;
}

export function ukMpgToLPer100km(mpg: number): number {
  const miles = 100 / KM_PER_MILE;
  const gallons = miles / mpg;
  return gallons * UK_GALLON_LITRES;
}

export function formatTank(litres: number, units: UnitSystem): string {
  if (units === "imperial") return `${litresToUkGallons(litres).toFixed(1)} gal`;
  return `${Math.round(litres)} L`;
}

export function formatThirst(litresPer100km: number, units: UnitSystem): string {
  if (units === "imperial") return `${Math.round(lPer100kmToUkMpg(litresPer100km))} mpg`;
  return `${litresPer100km.toFixed(1)} L/100km`;
}

/** Same band the efficient-fill maths will accept. Imperial mpg is the UK figure for those litres. */
export const THIRST_L_MIN = 2;
export const THIRST_L_MAX = 25;

export function thirstBounds(units: UnitSystem): { min: number; max: number; step: number } {
  if (units === "imperial") {
    return {
      min: Math.floor(lPer100kmToUkMpg(THIRST_L_MAX)),
      max: Math.floor(lPer100kmToUkMpg(THIRST_L_MIN)),
      step: 1,
    };
  }
  return { min: THIRST_L_MIN, max: THIRST_L_MAX, step: 0.1 };
}

export function thirstFieldText(litresPer100km: number, units: UnitSystem): string {
  if (units === "imperial") return String(Math.round(lPer100kmToUkMpg(litresPer100km)));
  return (Math.round(litresPer100km * 10) / 10).toFixed(1);
}

/** A finished in-range number, or null while the user is still typing. */
export function litresFromThirstDraft(raw: string, units: UnitSystem): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  const bounds = thirstBounds(units);
  if (value < bounds.min || value > bounds.max) return null;
  return litresFromThirstNumber(value, units);
}

/** Clamp a finished draft into range. Null when it is not a number yet. */
export function clampThirstDraft(raw: string, units: UnitSystem): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  const bounds = thirstBounds(units);
  const clamped = Math.min(bounds.max, Math.max(bounds.min, value));
  return litresFromThirstNumber(clamped, units);
}

function litresFromThirstNumber(value: number, units: UnitSystem): number {
  const litres = units === "imperial" ? ukMpgToLPer100km(value) : value;
  return Math.min(THIRST_L_MAX, Math.max(THIRST_L_MIN, litres));
}
