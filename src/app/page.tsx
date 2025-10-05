'use client'

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("../components/MapClient"), { ssr: false });

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-sm mt-1">{String(value)}</div>
    </div>
  );
}

type ScoreResult = {
  input: { lat: number; lon: number };
  metrics: {
    heatIndexF?: number;
    recentHotDays?: number;
    populationDensity?: number;
    nearbyHazards?: { count: number; nearestKm?: number; categories: Record<string, number> };
  };
  score: number;
  advice: string[];
};

export default function Home() {
  const [lat, setLat] = useState<number | ''>('');
  const [lon, setLon] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);

  const canScore = useMemo(() => typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon), [lat, lon]);

  function parseNum(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  }

  async function useMyLocation() {
    setResult(null);
    if (!navigator.geolocation) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLon(Number(pos.coords.longitude.toFixed(5)));
        setPicked({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function score() {
    if (!canScore) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`/api/score?lat=${lat}&lon=${lon}`).then((r) => r.json());
      setResult(r);
      setPicked({ lat: Number(lat), lon: Number(lon) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to score location";
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 sm:p-10 grid gap-6 bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between">
        <h1 className="text-lg sm:text-2xl font-semibold">NASA Liveability Advisor</h1>
        <div className="text-xs text-neutral-400">POWER • EONET • SEDAC • GIBS</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/60">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <input
                placeholder="Latitude"
                className="w-1/2 bg-neutral-800 border border-neutral-700 rounded px-3 py-2"
                value={lat}
                onChange={(e) => setLat(parseNum(e.target.value))}
              />
              <input
                placeholder="Longitude"
                className="w-1/2 bg-neutral-800 border border-neutral-700 rounded px-3 py-2"
                value={lon}
                onChange={(e) => setLon(parseNum(e.target.value))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={useMyLocation}
                className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-sm font-medium"
              >
                Use my location
              </button>
              <button
                onClick={score}
                disabled={!canScore || loading}
                className="px-3 py-2 rounded bg-emerald-600 disabled:bg-neutral-700 hover:bg-emerald-500 text-sm font-medium"
              >
                {loading ? "Scoring…" : "Score this location"}
              </button>
            </div>
          </div>

          <div className="h-[420px] mt-4 rounded overflow-hidden">
            <MapClient
              picked={picked}
              onPick={(pt) => {
                setLat(Number(pt.lat.toFixed(5)));
                setLon(Number(pt.lon.toFixed(5)));
                setPicked(pt);
              }}
            />
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Pick on map, paste coordinates, or use your device location. Zoom and click to set point.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/60">
          <h2 className="font-semibold mb-2">Results</h2>
          {!result && <div className="text-neutral-400 text-sm">Run a score to see health and livability insights.</div>}
          {result && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Heat index (yesterday)" value={result.metrics.heatIndexF ? `${Math.round(result.metrics.heatIndexF)} °F` : '—'} />
                <Metric label="Recent hot days (7d est.)" value={result.metrics.recentHotDays ?? '—'} />
                <Metric label="Population density (SEDAC)" value={result.metrics.populationDensity !== undefined ? `${Math.round(result.metrics.populationDensity)} ppl/km²` : '—'} />
                <Metric label="Nearby hazards (EONET, 100 km)" value={result.metrics.nearbyHazards?.count ?? 0} />
              </div>
              <div>
                <div className="text-neutral-300 font-medium mt-2">Advice</div>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  {result.advice.map((a, i) => (<li key={i}>{a}</li>))}
                </ul>
              </div>
              <div className="text-xl font-semibold">
                Liveability score: <span className="text-emerald-400">{Math.round(result.score)}</span>/100
              </div>
              <div className="text-xs text-neutral-500">
                Data sources: NASA POWER (heat), EONET (hazards), SEDAC GPW (pop). NDVI and imagery shown on map via NASA GIBS.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
