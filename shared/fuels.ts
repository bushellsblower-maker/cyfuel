import type { FuelId, PriceUnit } from "./types";

export const FUELS: Array<{ id: FuelId; label: string; hint: string }> = [
  { id: "petrol", label: "Petrol", hint: "Regular unleaded / gasoline" },
  { id: "premium", label: "Premium", hint: "Super unleaded" },
  { id: "diesel", label: "Diesel", hint: "Standard diesel" },
  { id: "dieselPlus", label: "Diesel+", hint: "Premium diesel" },
  { id: "lpg", label: "LPG", hint: "Autogas, when a pump lists it" },
];

export const LITRES_PER_UNIT: Record<PriceUnit, number> = {
  liter: 1,
  gallon: 3.785411784,
  imperial_gallon: 4.54609,
};

const GRADE_KEYS: Record<FuelId, string[]> = {
  petrol: ["gasoline", "gasoline_regular", "petrol91", "petrol95", "E10"],
  premium: ["gasoline_premium", "gasoline_super", "premium", "petrol98", "E5"],
  diesel: ["diesel", "diesel_regular", "B7_STANDARD"],
  dieselPlus: ["diesel_premium", "dieselPremium", "B7_PREMIUM"],
  lpg: ["lpg", "LPG"],
};

export function asUnit(value: string | null | undefined): PriceUnit {
  if (value === "gallon" || value === "imperial_gallon") return value;
  return "liter";
}

export function perLitre(published: number, unit: PriceUnit): number {
  return published / LITRES_PER_UNIT[unit];
}

/** UK Fuel Finder prices arrive in pence. A value already in pounds is left alone. */
export function ukPenceToMajor(value: number): number {
  return value >= 20 ? value / 100 : value;
}

export function pickGrade(
  prices: Record<string, unknown> | null | undefined,
  fuel: FuelId,
): number | null {
  if (!prices) return null;
  for (const key of GRADE_KEYS[fuel]) {
    const raw = prices[key];
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

export function unitCaption(unit: PriceUnit): string {
  if (unit === "gallon") return "US gal";
  if (unit === "imperial_gallon") return "imp gal";
  return "L";
}
