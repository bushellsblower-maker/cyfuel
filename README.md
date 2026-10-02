# cyfuel

A playful fuel-price map for [cyfuel.cybush.uk](https://cyfuel.cybush.uk). It does not just point at the cheapest sticker. It ranks an **efficient fill**: the cost of the tank plus the fuel you burn driving there.

```
drive litres ≈ (distance km ÷ km per litre) × (1 or 2 if you count the trip home)
drive cost   = drive litres × that station's price per litre
fill cost    = tank litres × station price
total        = fill cost + drive cost
```

Defaults are a 50 L tank and 7 L/100km. Both are editable, and a round-trip toggle doubles the drive.

## Run locally

```bash
npm ci
npm run dev
```

That starts the Worker on `http://127.0.0.1:8787` and the Vite app on `http://127.0.0.1:5173`. The app proxies `/api` to the Worker, which is the same shape production uses.

```bash
npm test
npm run build
```

## What you get

- Leaflet map with OpenStreetMap standard tiles (no API key), cartoon pump markers, and a world choropleth of national averages (coloured in EUR per litre, scale trimmed to the middle 80% so one wild price does not paint the planet one colour).
- Browser geolocation, with a city list or a dropped pin if permission is denied.
- Real forecourts where an open feed exists. Everywhere else, a capital pin labelled as a **national average — not a pump**.
- Petrol, premium, diesel, premium diesel, and LPG when a source publishes it.
- Pump prices in the local currency. Totals can be compared in the currency under your pin, or in another currency via OpenVan's euro rates.
- Prices that were published per gallon are converted to per litre for the maths, and the original unit is still mentioned.

## Data sources

All upstream calls go through the Worker (`/api/prices`, `/api/rates`, `/api/stations`) so caching and CORS stay in one place. Responses are stored with the Cache API (about 6 hours for country prices and rates, 15 minutes for stations). No KV namespace is required.

| What | Source | Licence / credit |
| --- | --- | --- |
| Country averages | [OpenVan.camp `/api/fuel/prices`](https://openvan.camp/api/fuel/prices) | CC BY 4.0 — attribute [OpenVan.camp](https://openvan.camp) |
| Exchange rates | [OpenVan.camp `/api/currency/rates`](https://openvan.camp/api/currency/rates) | CC BY 4.0 |
| France, Spain, Italy, Western Australia stations | [FuelWide](https://fuelwide.com/fuel-prices-api) | Credit the publisher string on each response: prix-carburants.gouv.fr (Licence Ouverte), Ministerio para la Transición Ecológica y el Reto Demográfico, MIMIT (CC BY 4.0), FuelWatch / Government of Western Australia (CC BY 4.0) |
| United Kingdom stations | [FuelCosts.co.uk](https://fuelcosts.co.uk/docs), redistributing UK Government Fuel Finder | Open Government Licence v3.0. The [official Fuel Finder API](https://www.gov.uk/guidance/access-the-latest-fuel-prices-and-forecourt-data-via-api-or-email) needs OAuth, so this no-key redistribution is what the Worker can cache. A few FuelCosts pins disagree with their own postcode; those are moved to the [postcodes.io](https://postcodes.io) centroid (ONS data, OGL) when the drift is over 20 km. |
| Country shapes | [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth 110m) | Natural Earth is public domain |
| Capitals | Natural Earth populated places | Public domain |
| Tiles | [OpenStreetMap standard tiles](https://tile.openstreetmap.org) | © OpenStreetMap contributors — [copyright](https://www.openstreetmap.org/copyright). No API key. These are the community servers, so keep traffic modest. |

Australia outside Western Australia, and most other countries, only have a national average. The map says so.

## Deploy

Production is the Worker **`cyfuel`** on **`cyfuel.cybush.uk`** (`custom_domain: true` in `wrangler.jsonc`). Account id `f027194dcc0be7e3812e673468bab58d` is in the Wrangler config and in the GitHub Actions workflow. The API token is **not** in the repo: it must be the Actions secret `CLOUDFLARE_API_TOKEN`.

Pushing to `main` runs `.github/workflows/deploy.yml`:

`npm ci` → `npm test` → `npm run build` → `npx wrangler deploy`

Deploy is cloud to cloud. Do not publish from a laptop.

The first successful deploy with `custom_domain: true` attaches `cyfuel.cybush.uk` on the `cybush.uk` zone (the token needs Workers Scripts and DNS edit on that zone). `workers_dev` is also enabled, so a `*.workers.dev` hostname is published alongside it.

Version stamp: **v1 · 2 Oct 2026** (footer and the tank notebook).
