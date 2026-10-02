import L from "leaflet";
import { useEffect, useRef } from "react";
import type { FuelId } from "../../shared/types";
import type { RankedStation } from "../../shared/rank";
import { convert } from "../../shared/money";
import type { CountryPrice } from "../../shared/types";
import { priceColor, scaleDomain } from "../lib/color";
import type { CountryShape } from "../lib/country";
import type { Scope } from "../lib/settings";
import { escapeHtml, formatUnit } from "../lib/format";

export type MapOrigin = {
  lat: number;
  lon: number;
  label: string;
  via: "geo" | "city" | "pin" | "country";
};

type Props = {
  shapes: CountryShape[];
  countries: CountryPrice[];
  rates: Record<string, number> | null;
  fuel: FuelId;
  origin: MapOrigin | null;
  ranked: RankedStation[];
  hunting: { lat: number; lon: number; label: string } | null;
  selectedId: string | null;
  pinMode: boolean;
  reducedMotion: boolean;
  compareCurrency: string;
  scope: Scope;
  colourByPrice: boolean;
  focusCode: string | null;
  layoutKey: string;
  onSelect: (id: string) => void;
  onDrop: (lat: number, lon: number) => void;
  onCountry: (code: string) => void;
};

// Community OSM tiles. No API key. The browser sends its own User-Agent;
// do not proxy these or the Worker becomes a tile CDN.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function MapView(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dotsRef = useRef<L.LayerGroup | null>(null);
  const pinModeRef = useRef(props.pinMode);
  const onDropRef = useRef(props.onDrop);
  const onCountryRef = useRef(props.onCountry);
  const onSelectRef = useRef(props.onSelect);
  const scopeRef = useRef(props.scope);
  pinModeRef.current = props.pinMode;
  scopeRef.current = props.scope;
  onDropRef.current = props.onDrop;
  onCountryRef.current = props.onCountry;
  onSelectRef.current = props.onSelect;

  useEffect(() => {
    const node = host.current;
    if (!node || mapRef.current) return;
    const map = L.map(node, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(TILES, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.setView([22, 8], 2);
    map.on("click", (event) => {
      if (!pinModeRef.current) return;
      onDropRef.current(event.latlng.lat, event.latlng.lng);
    });
    map.on("zoomend", () => {
      if (scopeRef.current !== "world") return;
      syncDots(map, dotsRef.current);
    });
    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 50);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    const timer = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(timer);
  }, [props.layoutKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (props.scope !== "world" && props.scope !== "country") return;
    const prices = eurPrices(props.countries, props.rates, props.fuel);
    const domain = scaleDomain([...prices.values()]);
    const visible =
      props.scope === "country" && props.focusCode
        ? props.shapes.filter((shape) => shape.code === props.focusCode)
        : props.shapes;
    const byCode = new Map(visible.map((shape) => [shape.code, shape]));
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: visible.map((shape) => ({
        type: "Feature",
        id: shape.code,
        geometry: shape.feature.geometry,
        properties: { code: shape.code, name: shape.name },
      })),
    };
    const layer = L.geoJSON(collection, {
      style: (feature) => {
        const code = String(feature?.properties?.code ?? "");
        const price = prices.get(code);
        const fill = countryFill(price, domain, props.colourByPrice);
        return { color: "#24170f", weight: 0.7, fillColor: fill, fillOpacity: props.colourByPrice ? 0.62 : 0.4 };
      },
      onEachFeature: (feature, leafletLayer) => {
        const code = String(feature.properties?.code ?? "");
        const shape = byCode.get(code);
        const price = prices.get(code);
        const label = shape
          ? `${shape.name}${price == null ? " · no published price" : ` · ${formatUnit(price, "EUR")}/L average`}`
          : code;
        leafletLayer.bindTooltip(label, { sticky: true });
        leafletLayer.on("click", (event) => {
          if (pinModeRef.current) return;
          L.DomEvent.stopPropagation(event);
          onCountryRef.current(code);
        });
      },
    }).addTo(map);

    const dots = L.layerGroup();
    for (const shape of visible) {
      const price = prices.get(shape.code);
      if (price == null) continue;
      L.circleMarker([shape.pin.lat, shape.pin.lon], {
        radius: 4,
        color: "#24170f",
        weight: 1,
        fillColor: countryFill(price, domain, props.colourByPrice),
        fillOpacity: 0.95,
      })
        .bindTooltip(`${shape.pin.place} · national average`, { direction: "top" })
        .addTo(dots);
    }
    dotsRef.current = dots;
    if (props.scope === "world") syncDots(map, dots);
    else dots.addTo(map);

    return () => {
      layer.remove();
      dots.remove();
      dotsRef.current = null;
    };
  }, [props.colourByPrice, props.countries, props.focusCode, props.fuel, props.rates, props.scope, props.shapes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const motion = props.reducedMotion;
    if (props.scope === "world") {
      moveMap(map, [22, 8], 2, motion);
      return;
    }
    if (!props.origin) return;
    if (props.scope === "country") {
      const shape = props.shapes.find((item) => item.code === props.focusCode);
      if (shape) {
        const bounds = L.geoJSON(shape.feature).getBounds();
        if (bounds.isValid()) {
          if (motion) map.fitBounds(bounds, { padding: [20, 20], animate: false });
          else map.flyToBounds(bounds, { padding: [20, 20], duration: 0.85 });
          return;
        }
      }
    }
    const km = props.scope === "country" ? 40 : Number(props.scope);
    const bounds = circleBounds(props.origin.lat, props.origin.lon, km);
    if (motion) map.fitBounds(bounds, { padding: [28, 28], animate: false });
    else map.flyToBounds(bounds, { padding: [28, 28], duration: 0.85 });
  }, [props.focusCode, props.origin, props.reducedMotion, props.scope, props.shapes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const huntingCoversYou =
      props.origin &&
      props.hunting &&
      Math.abs(props.origin.lat - props.hunting.lat) < 0.03 &&
      Math.abs(props.origin.lon - props.hunting.lon) < 0.03;
    if (props.origin && !huntingCoversYou) {
      L.marker([props.origin.lat, props.origin.lon], {
        icon: L.divIcon({
          className: "pin-wrap",
          html: `<div class="you-pin" title="${escapeHtml(props.origin.label)}"><span>You</span></div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        keyboard: false,
        zIndexOffset: 800,
      }).addTo(group);
    }
    const prices = props.ranked.map((row) => row.unitPrice);
    const mid = median(prices);
    for (const station of props.ranked) {
      const tone = !props.colourByPrice
        ? "ok"
        : station.badges.includes("efficient")
          ? "win"
          : station.unitPrice > mid * 1.05
            ? "ouch"
            : "ok";
      const selected = station.id === props.selectedId;
      const marker = L.marker([station.lat, station.lon], {
        icon: L.divIcon({
          className: "pin-wrap",
          html: pumpHtml(tone, formatUnit(station.unitPrice, props.compareCurrency), selected),
          iconSize: [64, 72],
          iconAnchor: [32, 68],
        }),
        keyboard: true,
        title: station.name,
        zIndexOffset: selected ? 700 : station.badges.includes("efficient") ? 500 : 0,
      });
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current(station.id);
      });
      marker.addTo(group);
    }
    if (props.hunting) {
      L.marker([props.hunting.lat, props.hunting.lon], {
        icon: L.divIcon({
          className: "pin-wrap",
          html: pumpHtml("hunt", "avg", true),
          iconSize: [64, 72],
          iconAnchor: [32, 68],
        }),
        keyboard: false,
        title: props.hunting.label,
        zIndexOffset: 600,
      }).addTo(group);
    }
    return () => {
      group.remove();
    };
  }, [props.colourByPrice, props.compareCurrency, props.hunting, props.origin, props.ranked, props.selectedId]);

  const domain = scaleDomain(
    props.rates ? [...eurPrices(props.countries, props.rates, props.fuel).values()] : [],
  );
  const localDomain = scaleDomain(props.ranked.map((row) => row.unitPrice));
  const wide = props.scope === "world" || props.scope === "country";

  return (
    <div className={`map-stage${props.pinMode ? " dropping" : ""}`}>
      <div ref={host} className="map-canvas" role="application" aria-label="Fuel map" />
      <div className="legend" aria-hidden="true">
        {props.colourByPrice ? (
          <>
            <span>Cheaper</span>
            <i className="legend-bar" />
            <span>Pricier</span>
            {wide && domain ? (
              <small>
                {formatUnit(domain.lo, "EUR")}–{formatUnit(domain.hi, "EUR")}/L · national averages
              </small>
            ) : localDomain ? (
              <small>
                {formatUnit(localDomain.lo, props.compareCurrency)}–{formatUnit(localDomain.hi, props.compareCurrency)}
                /L · these pumps
              </small>
            ) : (
              <small>Waiting for prices in this scope</small>
            )}
          </>
        ) : (
          <span>One colour. The stickers still talk.</span>
        )}
      </div>
      {props.pinMode ? <p className="pin-banner">Tap the map. I'll plant a brave little pin.</p> : null}
    </div>
  );
}

const NEUTRAL_FILL = "#e7d3b0";

function countryFill(price: number | undefined, domain: { lo: number; hi: number } | null, colourByPrice: boolean): string {
  if (!colourByPrice || price == null || !domain) return NEUTRAL_FILL;
  return priceColor((price - domain.lo) / (domain.hi - domain.lo));
}

function moveMap(map: L.Map, center: L.LatLngExpression, zoom: number, reducedMotion: boolean): void {
  if (reducedMotion) map.setView(center, zoom);
  else map.flyTo(center, zoom, { duration: 0.85 });
}

function circleBounds(lat: number, lon: number, km: number): L.LatLngBounds {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return L.latLngBounds([lat - dLat, lon - dLon], [lat + dLat, lon + dLon]);
}

function syncDots(map: L.Map, dots: L.LayerGroup | null): void {
  if (!dots) return;
  const show = map.getZoom() < 8;
  if (show && !map.hasLayer(dots)) dots.addTo(map);
  if (!show && map.hasLayer(dots)) map.removeLayer(dots);
}

function eurPrices(
  countries: CountryPrice[],
  rates: Record<string, number> | null,
  fuel: FuelId,
): Map<string, number> {
  const prices = new Map<string, number>();
  if (!rates) return prices;
  for (const country of countries) {
    const grade = country.grades[fuel];
    if (!grade) continue;
    const eur = convert(grade.perLitre, grade.currency, "EUR", rates);
    if (eur != null) prices.set(country.code, eur);
  }
  return prices;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function pumpHtml(tone: "win" | "ok" | "ouch" | "hunt", price: string, selected: boolean): string {
  const fill = tone === "win" ? "#1ea36a" : tone === "ouch" ? "#e23d4e" : tone === "hunt" ? "#8d7b6a" : "#ff8a3d";
  return `<div class="pump-pin pump-${tone}${selected ? " is-selected" : ""}">
    <span>${escapeHtml(price)}</span>
    <svg viewBox="0 0 48 56" width="34" height="40" aria-hidden="true">
      <rect x="8" y="16" width="24" height="32" rx="5" fill="${fill}" stroke="#24170f" stroke-width="2"/>
      <rect x="12" y="20" width="16" height="10" rx="2" fill="#fff8ee" stroke="#24170f" stroke-width="1.5"/>
      <circle cx="16" cy="24" r="1.3" fill="#24170f"/>
      <circle cx="23" cy="24" r="1.3" fill="#24170f"/>
      <path d="M14 28 Q20 32 26 28" fill="none" stroke="#24170f" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="30" y="22" width="8" height="5" rx="1.5" fill="#24170f"/>
      <path d="M38 24.5 v10 q0 6 -6 6" fill="none" stroke="#24170f" stroke-width="2" stroke-linecap="round"/>
      <rect x="14" y="6" width="12" height="11" rx="3" fill="#ffd447" stroke="#24170f" stroke-width="2"/>
    </svg>
  </div>`;
}
