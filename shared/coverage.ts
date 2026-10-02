export type RegionId = "GB" | "FR" | "ES" | "IT" | "AU";

type Box = {
  id: RegionId;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

/** Tight boxes. Callers expand them by the search radius so border towns can see both sides. */
const BOXES: Box[] = [
  { id: "GB", minLat: 49.85, maxLat: 60.9, minLon: -8.2, maxLon: 1.78 },
  { id: "FR", minLat: 41.3, maxLat: 51.15, minLon: -5.2, maxLon: 9.65 },
  { id: "ES", minLat: 35.9, maxLat: 43.85, minLon: -9.4, maxLon: 4.4 },
  { id: "ES", minLat: 27.6, maxLat: 29.5, minLon: -18.3, maxLon: -13.2 },
  { id: "IT", minLat: 35.45, maxLat: 47.12, minLon: 6.55, maxLon: 18.6 },
  // FuelWide's Australia feed is Western Australia only.
  { id: "AU", minLat: -35.2, maxLat: -13.5, minLon: 112.8, maxLon: 129.2 },
];

function covers(box: Box, lat: number, lon: number, radiusKm: number): boolean {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.25, Math.cos((lat * Math.PI) / 180)));
  return (
    lat >= box.minLat - dLat &&
    lat <= box.maxLat + dLat &&
    lon >= box.minLon - dLon &&
    lon <= box.maxLon + dLon
  );
}

/** Station feeds that might have a pump within `radiusKm` of this point. */
export function regionsNear(lat: number, lon: number, radiusKm: number): RegionId[] {
  const found: RegionId[] = [];
  for (const box of BOXES) {
    if (!covers(box, lat, lon, radiusKm)) continue;
    if (!found.includes(box.id)) found.push(box.id);
  }
  return found;
}
