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

- Leaflet map with OpenStreetMap standard tiles (no API key), cartoon pump markers, and a world choropleth of national averages (coloured in EUR per litre, scale trimmed to the middle 80% so one wild price does not paint the planet one colour). **Colour by price** is on by default and can be switched off; the map and list then use one cartoon colour.
- Scope chips: 5 km, 15 km, 50 km, country, or world. A local radius ranks nearby pumps and hides the world choropleth. Country and world keep national averages. Country station pins are the ones we can fetch within 80 km that still sit in that country.
- Browser geolocation, with a city list or a dropped pin if permission is denied. A city or a dropped pin becomes “here” immediately, and the map and list reload pumps for the scope you already picked (5, 15 or 50 km; country and world stay as they were). If that radius is empty, Pip says so.
- Real forecourts where an open feed exists. Everywhere else, a capital pin labelled as a **national average — not a pump**.
- Petrol, premium, diesel, premium diesel, and LPG when a source publishes it.
- A display currency on Fuel & tank (and in the tank notebook). It starts as the currency of the country under you, and stays on whatever you pick. Station prices, totals, and country averages are shown in that currency using OpenVan's free euro rates. A pump's own sticker is still mentioned when it differs.
- Prices that were published per gallon are converted to per litre for the maths, and the original unit is still mentioned.
- A Metric / Imperial toggle for the tank and thirst. Imperial is **UK**: imperial gallons and UK mpg (not US mpg). Type the thirst in the current units (mpg or L/100km); the notebook slider follows that number. The efficient-fill maths stays in litres and L/100km.
- “What do you drive?” asks Workers AI (`@cf/meta/llama-3.2-3b-instruct` on the `AI` binding) for a usable tank and, when it knows, a combined L/100km. The Worker strips markdown, retries once if the reply is not JSON, and falls back to a list of common cars (Golf, Focus, Civic, Saab, Astra, and so on, ignoring a leading year) when the model still waffles. A status line under the box stays on screen for success or the exact error. The Worker gives up after 12 seconds, and the page gives up after 15.

## Data sources

All upstream calls go through the Worker (`/api/prices`, `/api/rates`, `/api/stations`, `POST /api/car-tank`) so caching and CORS stay in one place. Responses are stored with the Cache API (about 6 hours for country prices and rates, 15 minutes for stations, a day for a repeated car lookup). No KV namespace is required.

`POST /api/car-tank` uses the Workers AI binding. That spends Cloudflare account neurons (the free tier / included allocation on a typical account). There is no separate paid model key and no third-party LLM.

| What | Source | Licence / credit |
| --- | --- | --- |
| Country averages | [OpenVan.camp `/api/fuel/prices`](https://openvan.camp/api/fuel/prices) | CC BY 4.0 — attribute [OpenVan.camp](https://openvan.camp) |
| Exchange rates | [OpenVan.camp `/api/currency/rates`](https://openvan.camp/api/currency/rates) | CC BY 4.0 |
| France, Spain, Italy, Western Australia stations | [FuelWide](https://fuelwide.com/fuel-prices-api) | Credit the publisher string on each response: prix-carburants.gouv.fr (Licence Ouverte), Ministerio para la Transición Ecológica y el Reto Demográfico, MIMIT (CC BY 4.0), FuelWatch / Government of Western Australia (CC BY 4.0) |
| United Kingdom stations | [FuelCosts.co.uk](https://fuelcosts.co.uk/docs), redistributing UK Government Fuel Finder | Open Government Licence v3.0. The [official Fuel Finder API](https://www.gov.uk/guidance/access-the-latest-fuel-prices-and-forecourt-data-via-api-or-email) needs OAuth, so this no-key redistribution is what the Worker can cache. A few FuelCosts pins disagree with their own postcode; those are moved to the [postcodes.io](https://postcodes.io) centroid (ONS data, OGL) when the drift is over 20 km. |
| Country shapes | [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth 110m) | Natural Earth is public domain |
| Capitals | Natural Earth populated places | Public domain |
| Tiles | [OpenStreetMap standard tiles](https://tile.openstreetmap.org) | © OpenStreetMap contributors — [copyright](https://www.openstreetmap.org/copyright). No API key. These are the community servers, so keep traffic modest. |
| Car tank guess | Workers AI `@cf/meta/llama-3.2-3b-instruct` | Account neurons via the `AI` binding. Smaller than 8B fp8 so a lookup is less likely to hang. Not a measured tank — Pip is guessing from the name. |

Australia outside Western Australia, and most other countries, only have a national average. The map says so.

## Deploy

Production is the Worker **`cyfuel`** on **`cyfuel.cybush.uk`** (`custom_domain: true` in `wrangler.jsonc`). Account id `f027194dcc0be7e3812e673468bab58d` is in the Wrangler config and in the GitHub Actions workflow. The API token is **not** in the repo: it must be the Actions secret `CLOUDFLARE_API_TOKEN`.

Pushing to `main` runs `.github/workflows/deploy.yml`:

`npm ci` → `npm test` → `npm run build` → `npx wrangler deploy`

Deploy is cloud to cloud. Do not publish from a laptop.

The first successful deploy with `custom_domain: true` attaches `cyfuel.cybush.uk` on the `cybush.uk` zone (the token needs Workers Scripts and DNS edit on that zone). `workers_dev` is also enabled, so a `*.workers.dev` hostname is published alongside it.

Version stamp: **v1 · 2 Oct 2026** (footer and the tank notebook).
