export type FuelId = "petrol" | "premium" | "diesel" | "dieselPlus" | "lpg";

export type PriceUnit = "liter" | "gallon" | "imperial_gallon";

export type CountryGrade = {
  perLitre: number;
  published: number;
  unit: PriceUnit;
  currency: string;
};

export type CountryPrice = {
  code: string;
  name: string;
  region: string | null;
  currency: string;
  fetchedAt: string | null;
  sources: string[];
  grades: Partial<Record<FuelId, CountryGrade>>;
};

export type Station = {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lon: number;
  address: string;
  currency: string;
  prices: Partial<Record<FuelId, number>>;
  updatedAt: string | null;
  source: "fuelwide" | "fuelcosts";
  country: string;
  attribution: string;
};

export type PricesPayload = {
  countries: CountryPrice[];
  updatedAt: string | null;
  attribution: string;
};

export type RatesPayload = {
  base: "EUR";
  rates: Record<string, number>;
  updatedAt: string | null;
  attribution: string;
};

export type StationsPayload = {
  stations: Station[];
  regions: string[];
  attributions: string[];
  radiusKm: number;
  note: string | null;
};

export type LatLng = {
  lat: number;
  lon: number;
};

export type RankMode = "efficient" | "cheapest" | "nearest";

export type Badge = "efficient" | "cheapest" | "nearest";
