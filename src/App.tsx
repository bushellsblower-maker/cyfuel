import { useEffect, useMemo, useState } from "react";
import { FUELS } from "../shared/fuels";
import { convert } from "../shared/money";
import { rankStations, sortRanked } from "../shared/rank";
import type { PricesPayload, RankMode, RatesPayload, StationsPayload } from "../shared/types";
import { APP_VERSION } from "../shared/version";
import { CityDialog, SettingsDialog } from "./components/Dialogs";
import { MapView, type MapOrigin } from "./components/MapView";
import { Mascot } from "./components/Mascot";
import { Sheet } from "./components/Sheet";
import { getPrices, getRates, getStations } from "./lib/api";
import { countryAt, countryShapes } from "./lib/country";
import { formatUnit } from "./lib/format";
import { mascotLine } from "./lib/quips";
import { usePreferences } from "./lib/settings";

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
  const [sheetOpen, setSheetOpen] = useState(true);

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

  useEffect(() => {
    if (!origin) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoadingStations(true);
      setStationError(null);
      getStations(origin.lat, origin.lon, settings.radiusKm, controller.signal)
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
  }, [origin, settings.radiusKm]);

  const here = origin ? countryAt(origin.lat, origin.lon, shapes) : null;
  const home = here ? (prices?.countries.find((country) => country.code === here.code) ?? null) : null;
  const compare =
    settings.compareCurrency === "standing" ? (home?.currency ?? "EUR") : settings.compareCurrency;

  const ranked = useMemo(() => {
    if (!origin || !rates || !stations) return [];
    return sortRanked(
      rankStations(stations.stations, origin, fuel, settings, rates.rates, compare),
      sort,
    );
  }, [compare, fuel, origin, rates, settings, sort, stations]);

  const speech = mascotLine({
    booting,
    hasOrigin: Boolean(origin),
    loading: loadingStations,
    ranked,
    homeName: home?.name ?? here?.name ?? null,
    compareCurrency: compare,
    fuelLabel: FUELS.find((item) => item.id === fuel)?.label ?? "Fuel",
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
    !loadingStations && ranked.length === 0 && here
      ? { lat: here.pin.lat, lon: here.pin.lon, label: `${here.pin.place} · national average, not a pump` }
      : null;

  return (
    <div className={`shell${sheetOpen ? "" : " sheet-collapsed"}`}>
      <a className="skip" href="#station-list">
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
      </header>
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
      <main className="stage">
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
          layoutKey={`${sheetOpen}-${settingsOpen}-${cityOpen}`}
          onSelect={(id) => {
            setSelectedId(id);
            setSheetOpen(true);
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
          }}
        />
        <Sheet
          open={sheetOpen}
          onToggle={() => setSheetOpen((open) => !open)}
          sort={sort}
          onSort={setSort}
          fuel={fuel}
          settings={settings}
          compareCurrency={compare}
          ranked={ranked}
          stations={stations}
          loading={loadingStations}
          error={stationError}
          home={home}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
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
              Map © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ©{" "}
              <a href="https://carto.com/attributions">CARTO</a>. Country shapes and capitals: Natural Earth. National
              averages are not pumps.
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
