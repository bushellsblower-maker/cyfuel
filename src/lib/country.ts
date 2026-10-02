import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldData from "world-atlas/countries-110m.json";
import capitals from "../data/capitals.json";
import isoNumeric from "../data/iso-numeric.json";

type WorldProps = { name?: string };

export type CountryShape = {
  code: string;
  name: string;
  feature: Feature<Geometry, WorldProps>;
  pin: { lat: number; lon: number; place: string };
};

const iso = isoNumeric as Record<string, string>;
const capitalPins = capitals as Record<string, { name: string; lat: number; lon: number }>;

let cached: CountryShape[] | null = null;

export function countryShapes(): CountryShape[] {
  if (cached) return cached;
  const topology = worldData as unknown as Topology<{ countries: GeometryCollection<WorldProps> }>;
  const collection = feature(topology, topology.objects.countries) as unknown as FeatureCollection<
    Geometry,
    WorldProps
  >;
  cached = collection.features.flatMap((item) => {
    const code = iso[String(Number(item.id))];
    if (!code || !item.geometry) return [];
    const capital = capitalPins[code];
    const fallback = centroid(item.geometry);
    return [
      {
        code,
        name: item.properties?.name || code,
        feature: item,
        pin: capital
          ? { lat: capital.lat, lon: capital.lon, place: capital.name }
          : { lat: fallback.lat, lon: fallback.lon, place: item.properties?.name || code },
      },
    ];
  });
  return cached;
}

export function countryAt(lat: number, lon: number, shapes: CountryShape[]): CountryShape | null {
  let best: CountryShape | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const shape of shapes) {
    if (!shape.feature.geometry || !contains(shape.feature.geometry, lon, lat)) continue;
    const area = Math.abs(geometryArea(shape.feature.geometry));
    if (area < bestArea) {
      best = shape;
      bestArea = area;
    }
  }
  return best;
}

function contains(geometry: Geometry, lon: number, lat: number): boolean {
  if (geometry.type === "Polygon") return polygonContains(geometry.coordinates, lon, lat);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => polygonContains(polygon, lon, lat));
  }
  return false;
}

function polygonContains(polygon: Position[][], lon: number, lat: number): boolean {
  let inside = false;
  for (const ring of polygon) {
    if (ringContains(ring, lon, lat)) inside = !inside;
  }
  return inside;
}

function ringContains(ring: Position[], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;
    const crosses = yi > lat !== yj > lat;
    if (!crosses) continue;
    const x = ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (lon < x) inside = !inside;
  }
  return inside;
}

function centroid(geometry: Geometry): { lat: number; lon: number } {
  const ring = largestRing(geometry);
  if (!ring.length) return { lat: 0, lon: 0 };
  const closed =
    ring.length > 1 && ring[0]?.[0] === ring[ring.length - 1]?.[0] && ring[0]?.[1] === ring[ring.length - 1]?.[1];
  const count = closed ? ring.length - 1 : ring.length;
  let lat = 0;
  let lon = 0;
  for (let i = 0; i < count; i += 1) {
    lon += ring[i]?.[0] ?? 0;
    lat += ring[i]?.[1] ?? 0;
  }
  return { lat: lat / count, lon: lon / count };
}

function largestRing(geometry: Geometry): Position[] {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  let best: Position[] = [];
  let bestArea = -1;
  for (const polygon of polygons) {
    const ring = polygon[0];
    if (!ring) continue;
    const area = Math.abs(ringArea(ring));
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

function geometryArea(geometry: Geometry): number {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.reduce((sum, polygon) => sum + Math.abs(ringArea(polygon[0] ?? [])), 0);
}

function ringArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;
    area += xj * yi - xi * yj;
  }
  return area / 2;
}
