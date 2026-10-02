import L from "leaflet";
import { useEffect, useRef } from "react";
import type { FuelId } from "../../shared/types";
import type { RankedStation } from "../../shared/rank";
import { convert } from "../../shared/money";
import type { CountryPrice } from "../../shared/types";
import { priceColor, scaleDomain } from "../lib/color";
import type { CountryShape } from "../lib/country";
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
  layoutKey: string;
  onSelect: (id: string) => void;
  onDrop: (lat: number, lon: number) => void;
  onCountry: (code: string) => void;
};

const TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export function MapView(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dotsRef = useRef<L.LayerGroup | null>(null);
  const pinModeRef = useRef(props.pinMode);
  const onDropRef = useRef(props.onDrop);
  const onCountryRef = useRef(props.onCountry);
  const onSelectRef = useRef(props.onSelect);
  pinModeRef.current = props.pinMode;
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
      subdomains: "abcd",
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    map.setView([22, 8], 2);
    map.on("click", (event) => {
      if (!pinModeRef.current) return;
      onDropRef.current(event.latlng.lat, event.latlng.lng);
    });
    map.on("zoomend", () => syncDots(map, dotsRef.current));
    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 50);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [props.layoutKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const prices = eurPrices(props.countries, props.rates, props.fuel);
    const domain = scaleDomain([...prices.values()]);
    const byCode = new Map(props.shapes.map((shape) => [shape.code, shape]));
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: props.shapes.map((shape) => ({
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
        if (price == null || !domain) {
          return { color: "#24170f", weight: 0.7, fillColor: "#e4d8c8", fillOpacity: 0.45 };
        }
        const t = (price - domain.lo) / (domain.hi - domain.lo);
        return { color: "#24170f", weight: 0.7, fillColor: priceColor(t), fillOpacity: 0.62 };
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
    for (const shape of props.shapes) {
      const price = prices.get(shape.code);
      if (price == null || !domain) continue;
      const t = (price - domain.lo) / (domain.hi - domain.lo);
      L.circleMarker([shape.pin.lat, shape.pin.lon], {
        radius: 4,
        color: "#24170f",
        weight: 1,
        fillColor: priceColor(t),
        fillOpacity: 0.95,
      })
        .bindTooltip(`${shape.pin.place} · national average`, { direction: "top" })
        .addTo(dots);
    }
    dotsRef.current = dots;
    syncDots(map, dots);

    return () => {
      layer.remove();
      dots.remove();
      dotsRef.current = null;
    };
  }, [props.countries, props.fuel, props.rates, props.shapes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.origin) return;
    const zoom = props.origin.via === "country" ? 5.5 : 12;
    const target: L.LatLngExpression = [props.origin.lat, props.origin.lon];
    if (props.reducedMotion) map.setView(target, zoom);
    else map.flyTo(target, zoom, { duration: 0.85 });
  }, [props.origin, props.reducedMotion]);

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
    for (const station of props.ranked) {
      const tone = station.badges.includes("efficient")
        ? "win"
        : station.unitPrice > median(props.ranked.map((row) => row.unitPrice)) * 1.05
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
  }, [props.compareCurrency, props.hunting, props.origin, props.ranked, props.selectedId]);

  const domain = scaleDomain(
    props.rates ? [...eurPrices(props.countries, props.rates, props.fuel).values()] : [],
  );

  return (
    <div className={`map-stage${props.pinMode ? " dropping" : ""}`}>
      <div ref={host} className="map-canvas" role="application" aria-label="World fuel map" />
      <div className="legend" aria-hidden="true">
        <span>Cheaper</span>
        <i className="legend-bar" />
        <span>Pricier</span>
        {domain ? (
          <small>
            {formatUnit(domain.lo, "EUR")}–{formatUnit(domain.hi, "EUR")}/L · middle 80%
          </small>
        ) : (
          <small>Waiting for country prices</small>
        )}
      </div>
      {props.pinMode ? <p className="pin-banner">Tap the map. I'll plant a brave little pin.</p> : null}
    </div>
  );
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
