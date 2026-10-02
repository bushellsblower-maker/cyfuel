import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CITIES } from "../data/cities";
import { currencyLabel } from "../lib/format";
import type { Settings } from "../lib/settings";

const COMPARE = [
  "standing",
  "GBP",
  "EUR",
  "USD",
  "AUD",
  "CAD",
  "CHF",
  "JPY",
  "INR",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "TRY",
  "BRL",
  "MXN",
  "ZAR",
  "CNY",
  "SGD",
];

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose}>
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn btn-small" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function SettingsDialog({
  open,
  settings,
  onClose,
  onChange,
}: {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <Modal open={open} title="The tank's little notebook" onClose={onClose}>
      <p className="modal-lead">Defaults assume a 50 L hatchback sipping 7 L/100km. Adjust if your car is thirstier or smugger.</p>
      <label className="field">
        <span>Tank size · {settings.tankLitres.toFixed(0)} L</span>
        <input
          type="range"
          min={20}
          max={120}
          step={1}
          value={settings.tankLitres}
          onChange={(event) => onChange({ tankLitres: Number(event.target.value) })}
        />
      </label>
      <label className="field">
        <span>Thirst · {settings.litresPer100km.toFixed(1)} L/100km</span>
        <input
          type="range"
          min={3}
          max={18}
          step={0.1}
          value={settings.litresPer100km}
          onChange={(event) => onChange({ litresPer100km: Number(event.target.value) })}
        />
      </label>
      <p className="field-help">
        How far to look is the scope row beside the fuels: 5, 15 or 50 km around the pin, the country under you, or the
        whole world.
      </p>
      <button
        type="button"
        className={`btn${settings.roundTrip ? " is-on" : ""}`}
        aria-pressed={settings.roundTrip}
        onClick={() => onChange({ roundTrip: !settings.roundTrip })}
      >
        {settings.roundTrip ? "Counting the drive home" : "One way only"}
      </button>
      <p className="field-help">The pump does not teleport you home. Switch this on when you have to come back.</p>
      <label className="field">
        <span>Compare totals in</span>
        <select
          value={settings.compareCurrency}
          onChange={(event) => onChange({ compareCurrency: event.target.value })}
        >
          {COMPARE.map((code) => (
            <option key={code} value={code}>
              {currencyLabel(code)}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help">Pump stickers stay in their own currency. The ranking uses this one so a pound and a euro can share a ruler.</p>
      <p className="version-stamp">v1 · 2 Oct 2026</p>
    </Modal>
  );
}

export function CityDialog({
  open,
  onClose,
  onPick,
  onDropMode,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (city: (typeof CITIES)[number]) => void;
  onDropMode: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CITIES;
    return CITIES.filter((city) => `${city.name} ${city.country}`.toLowerCase().includes(needle));
  }, [query]);

  return (
    <Modal open={open} title="Where shall we sniff?" onClose={onClose}>
      <p className="modal-lead">No location? No drama. Pick a city, or drop a pin like a polite pirate.</p>
      <label className="field">
        <span>Find a city</span>
        <input
          type="search"
          value={query}
          placeholder="Paris, Perth, Cardiff…"
          onChange={(event) => setQuery(event.target.value)}
          ref={inputRef}
        />
      </label>
      <ul className="city-list">
        {matches.map((city) => (
          <li key={`${city.name}-${city.country}`}>
            <button type="button" className="city-btn" onClick={() => onPick(city)}>
              <strong>
                {city.name}
                <small>{city.country}</small>
              </strong>
              <span>{city.blurb}</span>
            </button>
          </li>
        ))}
        {!matches.length ? <li className="empty-inline">That city isn't in my little gazetteer. Drop a pin instead.</li> : null}
      </ul>
      <button type="button" className="btn" onClick={onDropMode}>
        I'll drop a pin
      </button>
    </Modal>
  );
}
