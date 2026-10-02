import { useEffect, useState } from "react";
import { FUELS } from "../../shared/fuels";
import { unitCaption } from "../../shared/fuels";
import { convert } from "../../shared/money";
import { winner, type RankedStation } from "../../shared/rank";
import type { CountryPrice, FuelId, RankMode, StationsPayload } from "../../shared/types";
import { formatTank, formatThirst } from "../../shared/units";
import { priceColor, scaleDomain } from "../lib/color";
import { formatKm, formatLitres, formatMoney, formatUnit } from "../lib/format";
import { cardQuip, emptyScopeLine } from "../lib/quips";
import type { Scope, Settings } from "../lib/settings";

const MODES: Array<{ id: RankMode; label: string }> = [
  { id: "efficient", label: "Efficient fill" },
  { id: "cheapest", label: "Cheapest sticker" },
  { id: "nearest", label: "Nearest nozzle" },
];

type Props = {
  sort: RankMode;
  onSort: (mode: RankMode) => void;
  fuel: FuelId;
  settings: Settings;
  colourByPrice: boolean;
  scope: Scope;
  compareCurrency: string;
  ranked: RankedStation[];
  inScopeCount: number;
  placeLabel: string;
  stations: StationsPayload | null;
  rates: Record<string, number> | null;
  loading: boolean;
  error: string | null;
  home: CountryPrice | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function Sheet(props: Props) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setExpanded(false);
  }, [props.ranked]);

  useEffect(() => {
    if (!props.selectedId) return;
    document.getElementById(`station-${props.selectedId}`)?.scrollIntoView({ block: "nearest" });
  }, [props.selectedId]);

  const fuel = FUELS.find((item) => item.id === props.fuel);
  const best = winner(props.ranked, "efficient");
  const visible = expanded ? props.ranked : props.ranked.slice(0, 8);
  const homeGrade = props.home?.grades[props.fuel];
  const homeInDisplay =
    homeGrade && props.rates ? convert(homeGrade.perLitre, homeGrade.currency, props.compareCurrency, props.rates) : null;
  const uncovered = props.stations != null && props.stations.regions.length === 0;
  const priceScale = props.colourByPrice ? scaleDomain(props.ranked.map((row) => row.unitPrice)) : null;
  const scopeLine =
    props.scope === "world"
      ? "world averages"
      : props.scope === "country"
        ? "this country"
        : `${props.scope} km around the pin`;

  return (
    <section className={`sheet${props.colourByPrice ? "" : " is-plain"}`} aria-label="Station ranking" aria-busy={props.loading}>
      <div className="modes" role="tablist" aria-label="How to sort pumps">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={props.sort === mode.id}
            className={props.sort === mode.id ? "is-on" : ""}
            onClick={() => props.onSort(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <p className="assumptions">
        {formatTank(props.settings.tankLitres, props.settings.units)} tank ·{" "}
        {props.settings.units === "imperial" ? "Thirst (mpg) " : "Thirst (L/100km) "}
        {formatThirst(props.settings.litresPer100km, props.settings.units)}
        {props.settings.units === "imperial" ? " UK" : ""} ·{" "}
        {props.settings.roundTrip ? "there and back" : "one way"} · {scopeLine} · totals in {props.compareCurrency}
      </p>
      {homeGrade && props.home ? (
        <p className="avg-line">
          {props.home.name} average for {fuel?.label.toLowerCase()}:{" "}
          {formatUnit(homeInDisplay ?? homeGrade.perLitre, homeInDisplay == null ? homeGrade.currency : props.compareCurrency)}
          /L
          {homeGrade.unit === "liter"
            ? ". "
            : ` (published as ${formatUnit(homeGrade.published, homeGrade.currency)}/${unitCaption(homeGrade.unit)}). `}
          {props.scope === "world"
            ? "Shrink the scope when you want nozzles instead of averages."
            : props.ranked.length
              ? "The cards below are real pumps."
              : "Not a pump — the figure above is a national average."}
        </p>
      ) : null}
      {props.scope === "world" && !props.loading ? (
        <p className="hunt-card">World view shows national averages and hides the pump confetti.</p>
      ) : null}
      {props.loading ? <p className="status-line">Pumping nearby prices…</p> : null}
      {props.error ? <p className="status-line warn">{props.error}</p> : null}
      {props.scope !== "world" && !props.loading && !props.error && props.stations && props.inScopeCount === 0 && !props.ranked.length ? (
        <p className="hunt-card">{emptyScopeLine(props.scope, props.placeLabel, uncovered)}</p>
      ) : null}
      {props.scope !== "world" && !props.loading && props.inScopeCount > 0 && !props.ranked.length ? (
        <p className="hunt-card">
          Pumps are nearby, but none published {fuel?.label.toLowerCase()}. Try another grade — the hose has opinions.
        </p>
      ) : null}
      <ol id="station-list" className="station-list">
        {visible.map((station, index) => {
          const selected = station.id === props.selectedId;
          const sameMoney = station.currency === props.compareCurrency;
          return (
            <li key={station.id} id={`station-${station.id}`}>
              <button
                type="button"
                className={`station${selected ? " is-selected" : ""}`}
                onClick={() => props.onSelect(station.id)}
                aria-pressed={selected}
              >
                <span
                  className="rank-no"
                  style={
                    priceScale
                      ? {
                          background: priceColor(
                            (station.unitPrice - priceScale.lo) / (priceScale.hi - priceScale.lo),
                          ),
                        }
                      : undefined
                  }
                >
                  {index + 1}
                </span>
                <span className="station-copy">
                  <strong>{station.name}</strong>
                  <small>{station.address || station.brand}</small>
                  <span className="badges">
                    {station.badges.map((badge) => (
                      <em key={badge} className={`badge badge-${badge}`}>
                        {badge === "efficient" ? "Efficient" : badge === "cheapest" ? "Cheapest" : "Nearest"}
                      </em>
                    ))}
                  </span>
                  <span className="math">
                    {formatKm(station.distanceKm)} · {formatLitres(station.driveLitres)} burned
                    {props.settings.roundTrip ? " there and back" : ""} · drive {formatMoney(station.driveCost, props.compareCurrency)}
                  </span>
                  {selected ? <span className="card-quip">{cardQuip(station, props.ranked)}</span> : null}
                </span>
                <span className="station-price">
                  <b>
                    {formatUnit(station.unitPrice, props.compareCurrency)}
                    <small>/L</small>
                  </b>
                  {sameMoney ? null : (
                    <small>Sticker {formatUnit(station.localUnitPrice, station.currency)}/L</small>
                  )}
                  <span>All-in {formatMoney(station.total, props.compareCurrency)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {props.ranked.length > 8 ? (
        <button type="button" className="btn btn-block" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show the short list" : `Show the other ${props.ranked.length - 8}`}
        </button>
      ) : null}
      {best && props.sort !== "efficient" ? (
        <p className="field-help">
          Efficient fill is still {best.name} at {formatMoney(best.total, props.compareCurrency)} all-in.
        </p>
      ) : null}
    </section>
  );
}
