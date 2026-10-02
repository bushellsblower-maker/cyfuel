import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type Ref, type ToggleEvent } from "react";
import { haversineKm } from "../shared/geo";
import { FUELS } from "../shared/fuels";
import { convert } from "../shared/money";
import { rankStations, sortRanked } from "../shared/rank";
import type { PricesPayload, RankMode, RatesPayload, StationsPayload } from "../shared/types";
import { formatTank, formatThirst } from "../shared/units";
import { APP_VERSION } from "../shared/version";
import { CityDialog, SettingsDialog } from "./components/Dialogs";
import { MapView, type MapOrigin } from "./components/MapView";
import { Mascot } from "./components/Mascot";
import { Sheet } from "./components/Sheet";
import { getPrices, getRates, getStations, lookupCar } from "./lib/api";
import { countryAt, countryShapes } from "./lib/country";
import { formatUnit } from "./lib/format";
import { mascotLine, pipTankLine } from "./lib/quips";
import { fetchRadiusKm, SCOPES, usePreferences } from "./lib/settings";

type Toast = { id: string; message: string };

export function App() {
  const reducedMotion = useReducedMotion();
  const shapes = useMemo(() => countryShapes(), []);
  const { settings, fuel, setSettings, setFuel } = usePreferences();
  const [origin, setOrigin] = useState<MapOrigin | null>(null);
  const [prices, setPrices] = useState<PricesPayload | null>(null);
  const [rates, setRates] = useState<RatesPayload | null>(null);
  const [stations, setStations] = useState<StationsPayload | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [stationError, setStationError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootNonce, setBootNonce] = useState(0);
  const [loadingStations, setLoadingStations] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [sort, setSort] = useState<RankMode>("efficient");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [carQuery, setCarQuery] = useState("");
  const [carBusy, setCarBusy] = useState(false);
  const listRef = useRef<HTMLDetailsElement>(null);
  const desktop = useDesktop();

  useEffect(() => {
    const controller = new AbortController();
    setBooting(true);
    setBootError(null);
    Promise.all([getPrices(controller.signal), getRates(controller.signal)])
      .then(([nextPrices, nextRates]) => {
        setPrices(nextPrices);
        setRates(nextRates);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setBootError(error instanceof Error ? error.message : "The price tank is empty.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBooting(false);
      });
    return () => controller.abort();
  }, [bootNonce]);

  useEffect(() => {
    if (booting || bootError || origin) return;
    locate(false);
  }, [bootError, booting, origin]);

  const fetchKm = fetchRadiusKm(settings.scope);

  useEffect(() => {
    if (!origin || fetchKm == null) {
      setStations(null);
      setStationError(null);
      setLoadingStations(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoadingStations(true);
      setStationError(null);
      getStations(origin.lat, origin.lon, fetchKm, controller.signal)
        .then((payload) => {
          setStations(payload);
          setSelectedId(null);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setStationError(error instanceof Error ? error.message : "Stations slipped the nozzle.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingStations(false);
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [fetchKm, origin]);

  const here = origin ? countryAt(origin.lat, origin.lon, shapes) : null;
  const home = here ? (prices?.countries.find((country) => country.code === here.code) ?? null) : null;
  const compare =
    settings.compareCurrency === "standing" ? (home?.currency ?? "EUR") : settings.compareCurrency;

  const scopedStations = useMemo(() => {
    if (!origin || !stations || settings.scope === "world") return [];
    return stations.stations.filter((station) => {
      if (settings.scope === "country") {
        if (!here) return true;
        const code = countryAt(station.lat, station.lon, shapes)?.code ?? null;
        return code == null || code === here.code;
      }
      return haversineKm(origin, station) <= Number(settings.scope) + 0.2;
    });
  }, [here, origin, settings.scope, shapes, stations]);

  const ranked = useMemo(() => {
    if (!origin || !rates || settings.scope === "world") return [];
    return sortRanked(rankStations(scopedStations, origin, fuel, settings, rates.rates, compare), sort);
  }, [compare, fuel, origin, rates, scopedStations, settings, sort]);

  const speech = mascotLine({
    booting,
    hasOrigin: Boolean(origin),
    loading: loadingStations && settings.scope !== "world",
    ranked,
    homeName: home?.name ?? here?.name ?? null,
    compareCurrency: compare,
    fuelLabel: FUELS.find((item) => item.id === fuel)?.label ?? "Fuel",
    scope: settings.scope,
  });

  function toast(message: string): void {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4800);
  }

  function locate(manual: boolean): void {
    if (!navigator.geolocation) {
      setCityOpen(true);
      toast("This browser has no sense of place. Pick a city and I'll cope.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPinMode(false);
        setOrigin({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: "You, approximately",
          via: "geo",
        });
        if (manual) toast("Got you. Let's see who is being reasonable.");
      },
      () => {
        setCityOpen(true);
        toast("Location stayed shy. Pick a city or drop a pin — I won't tell.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }

  const hunting =
    settings.scope === "country" && !loadingStations && ranked.length === 0 && here
      ? { lat: here.pin.lat, lon: here.pin.lon, label: `${here.pin.place} · national average, not a pump` }
      : null;

  function lookupDrive(event: FormEvent): void {
    event.preventDefault();
    const car = carQuery.trim();
    if (carBusy) return;
    if (car.length < 2) {
      toast("Tell Pip what you drive. A blank box has a very small tank.");
      return;
    }
    setCarBusy(true);
    lookupCar(car)
      .then((estimate) => {
        setSettings({
          tankLitres: estimate.tankLitres,
          ...(estimate.efficiencyLPer100km != null ? { litresPer100km: estimate.efficiencyLPer100km } : {}),
        });
        toast(pipTankLine(estimate, settings.units));
      })
      .catch((error: unknown) => {
        toast(error instanceof Error ? error.message : "Pip dropped the brochure. The tank slider still works.");
      })
      .finally(() => setCarBusy(false));
  }

  function revealList(): void {
    setListOpen(true);
    if (listRef.current) listRef.current.open = true;
  }

  return (
    <div className="shell">
      <a
        className="skip"
        href="#station-list"
        onClick={() => {
          revealList();
        }}
      >
        Skip to the clever list
      </a>
      <header className="topbar">
        <div className="brand">
          <Mascot mood={speech.mood} />
          <div>
            <p className="eyebrow">Cybush</p>
            <h1>cyfuel</h1>
          </div>
        </div>
        <p className="speech" role="status">
          {speech.line}
        </p>
      </header>
      <Fold
        className="fold-controls"
        title="Fuel & tank"
        open={controlsOpen}
        desktop={desktop}
        onOpenChange={setControlsOpen}
      >
        <div className="controls-body">
          <div className="top-actions">
            <button type="button" className="btn" onClick={() => locate(true)}>
              Find me
            </button>
            <button type="button" className="btn" onClick={() => setCityOpen(true)}>
              Cities
            </button>
            <button type="button" className="btn" onClick={() => setSettingsOpen(true)}>
              Tank
            </button>
          </div>
          <div className="scopebar" role="radiogroup" aria-label="How far to look">
            {SCOPES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={settings.scope === item.id}
                className={settings.scope === item.id ? "is-on" : ""}
                onClick={() => setSettings({ scope: item.id })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="scopebar" role="radiogroup" aria-label="Tank and thirst units">
            <button
              type="button"
              role="radio"
              aria-checked={settings.units === "metric"}
              className={settings.units === "metric" ? "is-on" : ""}
              onClick={() => setSettings({ units: "metric" })}
            >
              Metric
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={settings.units === "imperial"}
              className={settings.units === "imperial" ? "is-on" : ""}
              onClick={() => setSettings({ units: "imperial" })}
            >
              Imperial
            </button>
          </div>
          <p className="unit-note">
            {settings.units === "imperial" ? "Tank (gal)" : "Tank (L)"} {formatTank(settings.tankLitres, settings.units)}
            {" · "}
            {settings.units === "imperial" ? "Thirst (mpg)" : "Thirst (L/100km)"}{" "}
            {formatThirst(settings.litresPer100km, settings.units)}
            {settings.units === "imperial" ? " · UK gallons and UK mpg, not US." : ""}
          </p>
          <form className="car-form" onSubmit={lookupDrive}>
            <label className="car-label">
              <span>What do you drive?</span>
              <input
                type="text"
                name="car"
                maxLength={80}
                value={carQuery}
                placeholder="2019 Golf 1.5 TSI"
                autoComplete="off"
                onChange={(event) => setCarQuery(event.target.value)}
              />
            </label>
            <button type="submit" className="btn" disabled={carBusy}>
              {carBusy ? "Asking Pip…" : "Lookup"}
            </button>
          </form>
          <button
            type="button"
            className={`btn${settings.colourByPrice ? " is-on" : ""}`}
            aria-pressed={settings.colourByPrice}
            onClick={() => setSettings({ colourByPrice: !settings.colourByPrice })}
          >
            Colour by price
          </button>
          <div className="fuelbar" role="radiogroup" aria-label="Fuel grade">
            {FUELS.map((item) => {
              const published = home?.grades[item.id];
              const comparable =
                published && rates ? convert(published.perLitre, published.currency, compare, rates.rates) : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={fuel === item.id}
                  className={fuel === item.id ? "is-on" : ""}
                  title={item.hint}
                  onClick={() => setFuel(item.id)}
                >
                  <strong>{item.label}</strong>
                  <small>{comparable == null ? item.hint : `${formatUnit(comparable, compare)}/L avg`}</small>
                </button>
              );
            })}
          </div>
        </div>
      </Fold>
      <main className="stage">
        <Fold
          className="fold-map"
          title="Map"
          open={mapOpen}
          desktop={desktop}
          onOpenChange={setMapOpen}
        >
          <MapView
            shapes={shapes}
            countries={prices?.countries ?? []}
            rates={rates?.rates ?? null}
            fuel={fuel}
            origin={origin}
            ranked={ranked}
            hunting={hunting}
            selectedId={selectedId}
            pinMode={pinMode}
            reducedMotion={reducedMotion}
            compareCurrency={compare}
            scope={settings.scope}
            colourByPrice={settings.colourByPrice}
            focusCode={here?.code ?? null}
            layoutKey={`${desktop}-${mapOpen}-${listOpen}-${controlsOpen}-${settingsOpen}-${cityOpen}`}
            onSelect={(id) => {
              setSelectedId(id);
              revealList();
            }}
            onDrop={(lat, lon) => {
              setPinMode(false);
              setOrigin({ lat, lon, label: "Dropped pin", via: "pin" });
              toast("Pin dropped. If a pump is nearby, it can no longer hide.");
            }}
            onCountry={(code) => {
              const shape = shapes.find((item) => item.code === code);
              if (!shape) return;
              setPinMode(false);
              setOrigin({
                lat: shape.pin.lat,
                lon: shape.pin.lon,
                label: `${shape.pin.place} · ${shape.name}`,
                via: "country",
              });
            toast(`Hopped to ${shape.pin.place}. Local pumps if we have them — otherwise just the average.`);
            setSettings({ scope: "country" });
          }}
          />
        </Fold>
        <Fold
          className="fold-list"
          title="The clever list"
          open={listOpen}
          desktop={desktop}
          onOpenChange={setListOpen}
          detailsRef={listRef}
        >
          <Sheet
            sort={sort}
            onSort={setSort}
            fuel={fuel}
            settings={settings}
            colourByPrice={settings.colourByPrice}
            scope={settings.scope}
            compareCurrency={compare}
            ranked={ranked}
            stations={stations}
            loading={loadingStations}
            error={stationError}
            home={home}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Fold>
      </main>
      <footer className="credits">
        <details className="sources">
          <summary>Sources & disclaimer</summary>
          <div className="sources-body">
            <p>
              Country prices and exchange rates: <a href="https://openvan.camp">OpenVan.camp</a> (CC BY 4.0).
            </p>
            <p>
              Station prices: France — prix-carburants.gouv.fr, Licence Ouverte; Spain — Ministerio para la Transición
              Ecológica y el Reto Demográfico; Italy — MIMIT, CC BY 4.0; Western Australia — FuelWatch, Government of
              Western Australia, CC BY 4.0; via <a href="https://fuelwide.com">FuelWide</a>.
            </p>
            <p>
              United Kingdom — UK Government Fuel Finder, Open Government Licence v3.0, via{" "}
              <a href="https://fuelcosts.co.uk">FuelCosts.co.uk</a>. The official Fuel Finder API needs OAuth, so this
              open copy is what we can cache. UK pins that disagree with their postcode are nudged using{" "}
              <a href="https://postcodes.io">postcodes.io</a> (ONS data, OGL).
            </p>
            <p>
              Map © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors. Country shapes
              and capitals: Natural Earth. National averages are not pumps.
            </p>
          </div>
        </details>
        <p className="version-stamp">{APP_VERSION}</p>
      </footer>
      <div className="toasts" aria-live="polite">
        {toasts.map((item) => (
          <p key={item.id} className="toast">
            {item.message}
          </p>
        ))}
      </div>
      {booting ? (
        <div className="boot" role="status">
          <Mascot mood="pump" />
          <p>Pumping the planet…</p>
        </div>
      ) : null}
      {bootError ? (
        <div className="boot boot-error" role="alert">
          <Mascot mood="ouch" />
          <p>{bootError}</p>
          <button type="button" className="btn" onClick={() => setBootNonce((value) => value + 1)}>
            Try the hose again
          </button>
        </div>
      ) : null}
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
      />
      <CityDialog
        open={cityOpen}
        onClose={() => setCityOpen(false)}
        onPick={(city) => {
          setCityOpen(false);
          setPinMode(false);
          setOrigin({ lat: city.lat, lon: city.lon, label: `${city.name}, ${city.country}`, via: "city" });
        }}
        onDropMode={() => {
          setCityOpen(false);
          setPinMode(true);
          toast("Drop-pin mode. Tap the map wherever the car actually is.");
        }}
      />
    </div>
  );
}

function Fold(props: {
  className: string;
  title: string;
  open: boolean;
  desktop: boolean;
  onOpenChange: (open: boolean) => void;
  detailsRef?: Ref<HTMLDetailsElement>;
  children: ReactNode;
}) {
  function onToggle(event: ToggleEvent<HTMLDetailsElement>): void {
    if (props.desktop) {
      event.currentTarget.open = true;
      return;
    }
    props.onOpenChange(event.currentTarget.open);
  }

  return (
    <details
      ref={props.detailsRef}
      className={`fold ${props.className}`}
      open={props.desktop || props.open}
      onToggle={onToggle}
    >
      <summary
        onClick={(event) => {
          if (props.desktop) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (props.desktop && (event.key === "Enter" || event.key === " ")) event.preventDefault();
        }}
      >
        {props.title}
        <span className="fold-state" aria-hidden="true" />
      </summary>
      <div className="fold-body">{props.children}</div>
    </details>
  );
}

function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 980px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 980px)");
    const onChange = () => setDesktop(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
