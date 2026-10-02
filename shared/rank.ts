import { haversineKm } from "./geo";
import { convert } from "./money";
import type { Badge, FuelId, LatLng, RankMode, Station } from "./types";

export type TripSettings = {
  tankLitres: number;
  litresPer100km: number;
  roundTrip: boolean;
};

export type RankedStation = Station & {
  distanceKm: number;
  driveLitres: number;
  driveCost: number;
  fillCost: number;
  total: number;
  /** Selected grade, per litre, in the comparison currency. */
  unitPrice: number;
  localUnitPrice: number;
  badges: Badge[];
};

/**
 * Effective cost of filling here.
 * drive litres = distance / (100 / L-per-100km), times two when the trip home counts.
 * The fuel burned is priced at this station — that's the pump you're about to use.
 */
export function costOfFill(
  distanceKm: number,
  pricePerLitre: number,
  settings: TripSettings,
): { driveLitres: number; driveCost: number; fillCost: number; total: number } {
  const kmPerLitre = 100 / settings.litresPer100km;
  const legs = settings.roundTrip ? 2 : 1;
  const driveLitres = (distanceKm * legs) / kmPerLitre;
  const driveCost = driveLitres * pricePerLitre;
  const fillCost = settings.tankLitres * pricePerLitre;
  return { driveLitres, driveCost, fillCost, total: fillCost + driveCost };
}

export function rankStations(
  stations: Station[],
  origin: LatLng,
  fuel: FuelId,
  settings: TripSettings,
  rates: Record<string, number>,
  compareCurrency: string,
): RankedStation[] {
  const ranked: RankedStation[] = [];
  for (const station of stations) {
    const localUnitPrice = station.prices[fuel];
    if (localUnitPrice == null || !Number.isFinite(localUnitPrice)) continue;
    const unitPrice = convert(localUnitPrice, station.currency, compareCurrency, rates);
    if (unitPrice == null) continue;
    const distanceKm = haversineKm(origin, station);
    const cost = costOfFill(distanceKm, unitPrice, settings);
    ranked.push({
      ...station,
      distanceKm,
      driveLitres: cost.driveLitres,
      driveCost: cost.driveCost,
      fillCost: cost.fillCost,
      total: cost.total,
      unitPrice,
      localUnitPrice,
      badges: [],
    });
  }
  return withBadges(ranked);
}

export function sortRanked(rows: RankedStation[], mode: RankMode): RankedStation[] {
  const copy = [...rows];
  if (mode === "cheapest") {
    copy.sort((a, b) => a.unitPrice - b.unitPrice || a.distanceKm - b.distanceKm);
  } else if (mode === "nearest") {
    copy.sort((a, b) => a.distanceKm - b.distanceKm || a.total - b.total);
  } else {
    copy.sort((a, b) => a.total - b.total || a.distanceKm - b.distanceKm);
  }
  return copy;
}

export function winner(rows: RankedStation[], mode: RankMode): RankedStation | null {
  return sortRanked(rows, mode)[0] ?? null;
}

function withBadges(rows: RankedStation[]): RankedStation[] {
  const efficient = winner(rows, "efficient");
  const cheapest = winner(rows, "cheapest");
  const nearest = winner(rows, "nearest");
  return rows.map((row) => {
    const badges: Badge[] = [];
    if (efficient && row.id === efficient.id) badges.push("efficient");
    if (cheapest && row.id === cheapest.id) badges.push("cheapest");
    if (nearest && row.id === nearest.id) badges.push("nearest");
    return { ...row, badges };
  });
}
