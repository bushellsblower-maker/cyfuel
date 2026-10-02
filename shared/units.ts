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
