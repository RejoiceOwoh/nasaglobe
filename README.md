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
- `src/app/page.tsx` — Home UI: inputs, map, overlay toggles, Featured cities
- `src/app/result/page.tsx` — Dedicated results page: score, metrics, narrative
- `src/components/MapClient.tsx` — Map with NASA GIBS overlays and click-to-pick
- `src/components/FeaturedCities.tsx` — Curated city grid linking to results
- `src/app/api/score/route.ts` — Scoring API using POWER/EONET/SEDAC (+ optional OpenAI)
- `src/app/globals.css` — Tailwind + Leaflet CSS imports

### Docs
See `TECHNICAL_DOCS.md` for data sources, methods, and architecture.

### Notes
- POWER data is typically delayed by ~1 day; Heat Index is based on the most recent day available.
- Air quality proxy is derived from EONET wildfire/dust/volcano signals.

### Optional: Richer LLM Narrative
If you want AI-generated concise guidance on the results page, set an OpenAI API key. Without it, the app uses the built-in rule-based narrative.

1) Create an API Key at https://platform.openai.com/ and copy it.
2) Locally, create a `.env.local` file at the project root with:

```
OPENAI_API_KEY=sk-your-key-here
```

3) On Vercel, add the same variable in Project Settings → Environment Variables.

The scoring API will automatically use the key when present and gracefully fall back when absent.
