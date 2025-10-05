# NASA Liveability Advisor — Technical Documentation

## Overview
An interactive Next.js (App Router) application that scores any location for livability using NASA Earth observation data. Users can:
- Click a map or use device geolocation
- Get a 0–100 score and health-oriented advice
- See overlays: True Color imagery and NDVI (greenness)

The solution is serverless and deploys cleanly to Vercel.

## Architecture
- UI: Next.js + React, Tailwind v4, Leaflet map via react-leaflet
- API: Next.js Route Handler `/api/score` (Node serverless on Vercel)
- Data Sources:
  - NASA POWER API: Historical daily temperature and humidity → Heat Index
  - NASA EONET API: Open events for hazards near the location
  - SEDAC WMS (CIESIN): Population density via GetFeatureInfo
  - NASA GIBS WMTS: Map imagery overlays (True Color; NDVI)

## Key Files
- `src/app/page.tsx` — Main UI: inputs, geolocation, map, results, overlay toggles
- `src/components/MapClient.tsx` — Leaflet map with OSM base + GIBS overlays; click-to-pick
- `src/app/api/score/route.ts` — Scoring route with POWER/EONET/SEDAC integration
- `src/app/globals.css` — Tailwind and Leaflet CSS imports

## Data & Methods
### NASA POWER (Heat Index and Recent Hot Days)
- Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point`
- Parameters: `T2M_MAX,T2M_MIN,RH2M` for last ~7 days
- Compute Heat Index (F) with NOAA formula using T_max and RH.
- Recent hot days: Count days with Heat Index > 100°F.

### EONET (Hazard Proximity)
- Endpoint: `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200`
- Parse latest point geometry for distance to the chosen location;
- Count events within 100 km; collect category histogram.

### Air Quality Proxy (AQP)
- Derived from EONET categories:
  - Wildfires: +30 penalty within 100 km, +15 within 300 km
  - Dust and Haze: +20 within 150 km, +10 within 300 km
  - Volcanoes: +15 within 150 km, +8 within 300 km
- AQP = clamp(95 - min(60, totalPenalty), 0, 100). Higher is better.
- Purpose: Provide a rapid, explanation-friendly AQ signal without external paid APIs.

### SEDAC Population Density
- WMS GetFeatureInfo against `gpw-v4:gpw-v4-population-density_2020` at the coordinate.
- Used as a proxy for crowding/noise/service-access tradeoffs.

### Scoring
- Baseline: 10 points
- Heat (max 40): Better scores for lower Heat Index
- Hazards (max 30): Fewer/ farther events score higher
- Density (max 20): Lower density slightly preferred
- Clamped to [0, 100]
- Advice: Rule-based messages for heat, hazards, density, and AQP

## UI Details
- Dark theme with neutral accents
- Cards for inputs and results
- Map overlay toggles (True Color, NDVI)
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
- No environment variables required.

## Limitations & Notes
- CORS and rate limits: All data sources are public and CORS-friendly at modest rates.
- POWER may lag by 1 day; we use yesterday’s T_max as the primary daily indicator.
- SEDAC WMS returns approximate values at pixel center; good enough for planning UX.
- AQP is a proxy; for production AQI, integrate official air quality APIs.

## Extensibility
- Add more overlays (GIBS AOD, NO2, LST)
- Add routing to compare multiple candidate locations
- Persist recent searches in LocalStorage
- Replace rule-based narrative with LLM-generated text via Vercel AI SDK (requires API key)

## Acknowledgements
NASA Space Apps, NASA Earth Science Division, POWER, EONET, SEDAC/CIESIN, GIBS.
