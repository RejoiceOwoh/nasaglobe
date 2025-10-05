# NASA Liveability Advisor — Technical Documentation

## Overview
An interactive Next.js (App Router) application that scores any location for livability using NASA Earth observation data. Users can:
- Click a map or use device geolocation
- Get a 0–100 score and health-oriented advice
 See overlays: True Color, NDVI (greenness), LST (surface heat), AOD (aerosols), Night Lights (urbanization), and Water mask

The solution is serverless and deploys cleanly to Vercel.

## Architecture
- UI: Next.js + React, Tailwind v4, Leaflet map via react-leaflet
- API: Next.js Route Handler `/api/score` (Node serverless on Vercel)
- Data Sources:
  - NASA POWER API: Historical daily temperature and humidity → Heat Index
  - NASA EONET API: Open events for hazards near the location
  - SEDAC WMS (CIESIN): Population density via GetFeatureInfo
  - NASA GIBS WMTS: Map imagery overlays (True Color; NDVI; LST; AOD; Night Lights; Water)
  - Open‑Meteo: Current weather (temperature, humidity, apparent temp, wind, gusts, precip, cloud, UV)
  - OpenAQ: Real-time PM2.5 → US AQI
  - OSM Nominatim: Reverse geocoding for place names

## Key Files
- `src/app/page.tsx` — Main UI: inputs, geolocation, map, overlay toggles, Discover grid
- `src/components/MapClient.tsx` — Leaflet map with OSM base + GIBS overlays; click-to-pick
- `src/app/result/page.tsx` — Dedicated results route with score, metrics, narrative
- `src/components/FeaturedCities.tsx` — Discover grid linking to results
- `src/app/api/score/route.ts` — Scoring route with POWER/EONET/SEDAC integration (+ optional OpenAI)
- `src/app/globals.css` — Tailwind and Leaflet CSS imports

## Data & Methods
### NASA POWER (Heat Index: daily + hourly)
Purpose: Quantify heat stress consistently worldwide and add near real-time signals.

1) Daily endpoint
- URL: `https://power.larc.nasa.gov/api/temporal/daily/point`
- Parameters: `parameters=T2M_MAX,T2M_MIN,RH2M`, `start=YYYYMMDD`, `end=YYYYMMDD`, `latitude`, `longitude`, `community=AG`, `format=JSON`
- Use: We parse the last 7 days, take the most recent day’s T2M_MAX and RH2M, and compute Heat Index in °F using the NOAA equation. We also count `recentHotDays` as the number of days with HI > 100°F.

2) Hourly endpoint
- URL: `https://power.larc.nasa.gov/api/temporal/hourly/point`
- Parameters: `parameters=T2M,RH2M`, `start=YYYYMMDD`, `end=YYYYMMDD` (UTC), `latitude`, `longitude`, `community=AG`, `time-standard=UTC`, `format=JSON`
- Use: We compute `maxHeatIndex24hF` from the last 24 hourly values, and a near-time `currentHeatIndexF` from the most recent hour when available.

Key outputs derived
- `metrics.heatIndexF`: Most recent daily HI (from POWER daily)
- `metrics.currentHeatIndexF`: Real-time HI (from POWER hourly or Open‑Meteo fallback)
- `metrics.maxHeatIndex24hF`: Max HI in trailing 24h (from POWER hourly)
- `metrics.recentHotDays`: Count of recent extreme-heat days

Why it matters / achieved
- Adds true temporal variation so hot regions read hotter right now, not just climatologically.
- Supports intuitive badges (Low → Extreme heat risk) and concrete advice.

### EONET (Hazard Proximity)
- Endpoint: `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200`
- Parse latest point geometry for distance to the chosen location;
- Count events within 100 km; collect category histogram.

How used
- `nearbyHazards.count`: Number of open events within 100 km
- `nearbyHazards.nearestKm`: Distance to nearest event
- `nearbyHazards.categories`: Histogram of event types
- Flood badge: Set when a Floods category appears within range

Achievements
- Gives immediate situational awareness for natural hazards nearby (wildfire, flood, volcano, dust/haze, storms, etc.).

### Air Quality Proxy (AQP)
- Derived from EONET categories:
  - Wildfires: +30 penalty within 100 km, +15 within 300 km
  - Dust and Haze: +20 within 150 km, +10 within 300 km
  - Volcanoes: +15 within 150 km, +8 within 300 km
- AQP = clamp(95 - min(60, totalPenalty), 0, 100). Higher is better.
- Purpose: Provide a rapid, explanation-friendly AQ signal without external paid APIs.

Achievements
- Enables a global, free AQ indicator even when no nearby regulatory station exists.

### SEDAC Population Density
- WMS GetFeatureInfo against `gpw-v4:gpw-v4-population-density_2020` at the coordinate.
- Used as a proxy for crowding/noise/service-access tradeoffs.

Endpoint & request pattern
- Base: `https://sedac.ciesin.columbia.edu/geoserver/wms`
- Request: `GetFeatureInfo` with a tiny bounding box around the point (`bbox=lon±0.01,lat±0.01`, `width=101`, `height=101`, `i=50`, `j=50`) to sample the center pixel.
- Response: `application/json`, using `GRAY_INDEX`/`gridcode`/`DN` for density.

Outputs
- `metrics.populationDensity`: Persons per km² at the location (approximate)
- Influences the density component of the score and related advice text

Achievements
- Provides a transparent urbanization signal to balance heat/hazards tradeoffs.

### NASA GIBS WMTS (Map Overlays)
Live, contextual layers help users understand why a score looks the way it does.

Layers used
- True Color: `MODIS_Terra_CorrectedReflectance_TrueColor`
- NDVI (greenness): `MODIS_Combined_NDVI_16Day`
- Land Surface Temp (daytime): `MODIS_Terra_LST_Day_1km`
- Aerosol Optical Depth: `MODIS_Terra_Aerosol`
- Night Lights (urbanization proxy): `VIIRS_CityLights_2012`
- Water mask / shaded relief: `BlueMarble_ShadedRelief_Bathymetry`

Tile pattern
`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{LAYER}/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.{jpg|png}`

Achievements
- Makes heat islands and greenness differences visible (e.g., high LST + low NDVI).
- Night lights quickly conveys settlement intensity; water layer clarifies coastlines/lakes.

### Supporting Non‑NASA Sources
These complement NASA data for a more immediate and user-friendly product.

Open‑Meteo (current weather)
- Endpoint: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover,uv_index&timezone=UTC`
- Use: Provides “Now” metrics on the results page and a fallback/augment for `currentHeatIndexF` when POWER hourly is missing or delayed.

OpenAQ (real-time PM2.5 → US AQI)
- Endpoint: `https://api.openaq.org/v2/latest?coordinates={lat},{lon}&radius={m}&parameter=pm25&limit=1`
- Use: Converts PM2.5 to approximate US AQI for a real-time air quality readout (`metrics.airNow`).

OSM Nominatim (reverse geocoding)
- Endpoint: `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&zoom=10`
- Use: Human-friendly place names and settlement type for headers and narrative context.

### Scoring
Weighted, bounded components produce a 0–100 score.

- Baseline: +10
- Heat burden (0–40): Based on `currentHeatIndexF` when available, else daily HI
- Hazards proximity (0–30): Fewer/ farther EONET events score higher
- Population pressure (0–20): Lower density slightly preferred (proxy for quiet/space)
- Clamp: Score is rounded and clamped to [0, 100]
- Advice: Rule-based bullets for heat, hazards, density, AQ proxy; optionally augmented by LLM bullets when an API key is provided

Badges
- Health badge: Derived from Heat Index category (Low → Moderate → High → Very High → Extreme)
- Flood badge: Set when an open Floods event exists nearby via EONET

### Badges
- Health badge derived from Heat Index category (Low → Extreme)
- Flood badge set when EONET reports an open Flood event within ~100 km

### Optional LLM Narrative
If `OPENAI_API_KEY` is present, the API will ask OpenAI (model: `gpt-4o-mini`) to produce 3–6 concise, actionable bullets based on the computed metrics. Errors or missing keys fall back to the rule-based narrative only.

## UI Details
- Dark theme with neutral accents
- Cards for inputs and results
- Map overlay toggles (True Color, NDVI, LST, AOD, Night Lights, Water)
- Score badge with color scale (red → orange → yellow → green)
- Hazard category chips from EONET

## Running Locally
```bash
npm install
npm run dev
```
Open http://localhost:3000 and interact.

## Deployment on Vercel
- Push to GitHub and import the repo into Vercel.
- Build command: `next build`
- Output: Serverless functions for API routes; static assets for UI.
- No environment variables required for core features.
- Optional: `OPENAI_API_KEY` for richer narrative.

## Limitations & Notes
- CORS and rate limits: All data sources are public and CORS-friendly at modest rates.
- POWER daily may lag by ~1 day; hourly can still provide near-time signals.
- SEDAC WMS returns approximate values at pixel center; good enough for planning UX.
- AQP is a proxy; for production AQI, integrate official air quality APIs.

Caching & reliability
- Each external call uses conservative timeouts and safe JSON parsing to avoid hard failures. Partial results are returned with “Note:” messages when a source is temporarily unavailable.

Attribution
- NASA POWER, EONET, GIBS imagery courtesy of NASA.
- SEDAC population density courtesy of CIESIN/Columbia University.
- Weather by Open‑Meteo; air quality by OpenAQ; geocoding by OpenStreetMap Nominatim.

## What these data achieved in the product
- Real-time heat awareness: Current Heat Index and 24h max show meaningful differences across places and times of day.
- Hazard context: Users immediately see if recent wildfire/flood/volcano activity is nearby and how far.
- Air signal two ways: A free, global AQ proxy from hazards and a measured PM2.5→AQI when stations exist.
- Urbanization insight: Population density and night lights help explain tradeoffs between services and quiet/space.
- Visual intuition: LST, NDVI, and aerosol overlays make “why the score looks this way” obvious.
- Resilience to outages: If a source is down or slow, the app still returns a partial, useful answer with notes.

## Extensibility
- Add more overlays (GIBS AOD, NO2, LST)
- Add routing to compare multiple candidate locations
- Persist recent searches in LocalStorage
- Replace rule-based narrative with LLM-generated text via Vercel AI SDK (requires API key)

## Acknowledgements
NASA Space Apps, NASA Earth Science Division, POWER, EONET, SEDAC/CIESIN, GIBS.
