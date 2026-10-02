import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CITIES } from "../data/cities";
import { COMPARE_CURRENCIES } from "../lib/currencies";
import { currencyLabel } from "../lib/format";
import type { Settings } from "../lib/settings";
import { lPer100kmToUkMpg, litresToUkGallons, ukGallonsToLitres, ukMpgToLPer100km } from "../../shared/units";

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
  const imperial = settings.units === "imperial";
  const gallons = Number(litresToUkGallons(settings.tankLitres).toFixed(1));
  const mpg = Math.round(lPer100kmToUkMpg(settings.litresPer100km));
  return (
    <Modal open={open} title="The tank's little notebook" onClose={onClose}>
      <p className="modal-lead">
        {imperial
          ? "Imperial here means UK gallons and UK mpg, not the smaller US ones. The sums underneath still think in litres."
          : "Defaults assume a 50 L hatchback sipping 7 L/100km. Adjust if your car is thirstier or smugger."}
      </p>
      <label className="field">
        <span>{imperial ? `Tank (gal) · ${gallons.toFixed(1)} UK` : `Tank (L) · ${settings.tankLitres.toFixed(0)}`}</span>
        {imperial ? (
          <input
            type="range"
            min={4}
            max={26}
            step={0.1}
            value={gallons}
            onChange={(event) => onChange({ tankLitres: ukGallonsToLitres(Number(event.target.value)) })}
          />
        ) : (
          <input
            type="range"
            min={20}
            max={120}
            step={1}
            value={settings.tankLitres}
            onChange={(event) => onChange({ tankLitres: Number(event.target.value) })}
          />
        )}
      </label>
      <label className="field">
        <span>{imperial ? `Thirst (mpg) · ${mpg} UK` : `Thirst (L/100km) · ${settings.litresPer100km.toFixed(1)}`}</span>
        {imperial ? (
          <input
            type="range"
            min={15}
            max={90}
            step={1}
            value={mpg}
            onChange={(event) => onChange({ litresPer100km: ukMpgToLPer100km(Number(event.target.value)) })}
          />
        ) : (
          <input
            type="range"
            min={3}
            max={18}
            step={0.1}
            value={settings.litresPer100km}
            onChange={(event) => onChange({ litresPer100km: Number(event.target.value) })}
          />
        )}
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
        <span>Display currency</span>
        <select
          aria-label="Display currency"
          value={settings.compareCurrency}
          onChange={(event) => onChange({ compareCurrency: event.target.value })}
        >
          {COMPARE_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {currencyLabel(code)}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help">
        Where I'm standing follows the country under the pin. Pick a currency to keep it. Prices on the map and in the
        list use that currency, via the free euro rates already loaded. The same picker sits on Fuel & tank.
      </p>
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
