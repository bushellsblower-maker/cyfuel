import { useEffect, useState } from "react";
import { FUELS } from "../../shared/fuels";
import { unitCaption } from "../../shared/fuels";
import { winner, type RankedStation } from "../../shared/rank";
import type { CountryPrice, FuelId, RankMode, StationsPayload } from "../../shared/types";
import { formatKm, formatLitres, formatMoney, formatUnit } from "../lib/format";
import { cardQuip } from "../lib/quips";
import type { Settings } from "../lib/settings";

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
  compareCurrency: string;
  ranked: RankedStation[];
  stations: StationsPayload | null;
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

  return (
    <section className="sheet" aria-label="Station ranking" aria-busy={props.loading}>
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
        {props.settings.tankLitres.toFixed(0)} L tank · {props.settings.litresPer100km.toFixed(1)} L/100km ·{" "}
        {props.settings.roundTrip ? "there and back" : "one way"} · totals in {props.compareCurrency}
      </p>
      {homeGrade && props.home ? (
        <p className="avg-line">
          {props.home.name} average for {fuel?.label.toLowerCase()}: {formatUnit(homeGrade.perLitre, homeGrade.currency)}
          /L
          {homeGrade.unit === "liter"
            ? ". "
            : ` (published as ${formatUnit(homeGrade.published, homeGrade.currency)}/${unitCaption(homeGrade.unit)}). `}
          {props.ranked.length ? "The cards below are real pumps." : "Not a pump — we're still hunting local nozzles."}
        </p>
      ) : null}
      {props.loading ? <p className="status-line">Pumping nearby prices…</p> : null}
      {props.error ? <p className="status-line warn">{props.error}</p> : null}
      {props.stations?.note && !props.ranked.length && !props.loading ? (
        <p className="hunt-card">{props.stations.note}</p>
      ) : null}
      {!props.loading && props.stations && props.stations.stations.length > 0 && !props.ranked.length ? (
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
                <span className="rank-no">{index + 1}</span>
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
                    {formatUnit(station.localUnitPrice, station.currency)}
                    <small>/L</small>
                  </b>
                  {sameMoney ? null : <small>{formatUnit(station.unitPrice, props.compareCurrency)}/L</small>}
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
