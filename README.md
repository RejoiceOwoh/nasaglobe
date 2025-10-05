## NASA Liveability Advisor

An interactive tool that scores any location for livability using NASA Earth observation data. Users can click the map or use device geolocation and receive a 0–100 score, metrics, and plain-language advice. Built with Next.js (App Router) and deployable to Vercel.

### Tech Stack
- Next.js 15 (App Router)
- React 19
- Tailwind CSS v4
- Leaflet + react-leaflet
- NASA POWER, EONET, SEDAC WMS, and GIBS WMTS

### Run Locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

### Deploy on Vercel
Push this repo and import it into Vercel. Default settings work:
- Build: `next build`
- Output: Serverless functions for `/api/*`

### Files of Interest
- `src/app/page.tsx` — UI: inputs, map, results panel, overlay toggles
- `src/components/MapClient.tsx` — Map with NASA GIBS overlays and click-to-pick
- `src/app/api/score/route.ts` — Scoring API using POWER/EONET/SEDAC
- `src/app/globals.css` — Tailwind + Leaflet CSS imports

### Docs
See `TECHNICAL_DOCS.md` for data sources, methods, and architecture.

### Notes
- POWER data is typically delayed by ~1 day; Heat Index is based on the most recent day available.
- Air quality proxy is derived from EONET wildfire/dust/volcano signals.
