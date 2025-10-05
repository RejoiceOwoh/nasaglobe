"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type ScoreResult = {
  input: { lat: number; lon: number };
  metrics: {
    heatIndexF?: number;
    currentHeatIndexF?: number;
    currentHeatIndexSource?: 'open-meteo' | 'power-hourly' | 'power-daily';
    maxHeatIndex24hF?: number;
    recentHotDays?: number;
    populationDensity?: number;
    nearbyHazards?: { count: number; nearestKm?: number; categories: Record<string, number> };
    airQualityProxy?: number;
    airNow?: { pm25?: number; aqiUS?: number; observedAt?: string };
    healthBadge?: string;
    floodBadge?: string;
  };
  score: number;
  advice: string[];
  adviceSource?: 'llm' | 'rule';
};

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-neutral-400">{children}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">{children}</div>;
}

function Metric({ label, value, hint }: { label: string; value: string | number | undefined; hint?: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {hint ? <span title={hint} className="text-neutral-500 text-xs">ⓘ</span> : null}
      </div>
      <div className="text-sm mt-1">{value ?? '—'}</div>
    </div>
  );
}

function ResultInner() {
  const params = useSearchParams();
  const lat = useMemo(() => Number(params.get('lat')), [params]);
  const lon = useMemo(() => Number(params.get('lon')), [params]);
  const valid = Number.isFinite(lat) && Number.isFinite(lon);

  const [data, setData] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!valid) { setData(null); return; }
      try {
        const res = await fetch(`/api/score?lat=${lat}&lon=${lon}`, { cache: 'no-store' });
        const json = await res.json();
        if (alive) setData(json);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [lat, lon, valid]);

  const score = data?.score ?? 50;
  const metrics = data?.metrics ?? {};
  const advice = Array.isArray(data?.advice) ? data!.advice : [];
  const adviceSource = data?.adviceSource;
  const [qa, setQa] = useState<{ q: string; a: string; loading?: boolean; error?: string } | null>(null);

  function scoreColor(s: number) {
    if (s >= 80) return "text-emerald-400";
    if (s >= 60) return "text-yellow-300";
    if (s >= 40) return "text-orange-400";
    return "text-red-400";
  }

  return (
    <div className="min-h-screen p-6 sm:p-10 bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Location Score</h1>
          {valid && (
            <div className="text-xs text-neutral-400">{lat.toFixed(5)}, {lon.toFixed(5)}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const url = typeof window !== 'undefined' ? window.location.href : '';
              try {
                if (navigator.share) {
                  await navigator.share({ title: 'NASA Liveability Score', url });
                } else if (navigator.clipboard) {
                  await navigator.clipboard.writeText(url);
                  alert('Link copied to clipboard');
                }
              } catch {
                // ignore
              }
            }}
            className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-sm"
            title="Share this result"
          >
            Share/Copy
          </button>
          <Link href="/" className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-sm font-medium">Score another location</Link>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <div className="text-neutral-300 font-medium mb-3">Overview</div>
          {loading ? (
            <div className="animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700" />
                <div className="h-10 w-48 bg-neutral-800 rounded" />
              </div>
              <div className="h-4 w-64 bg-neutral-800 rounded mt-4" />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border border-neutral-700 bg-neutral-800 ${scoreColor(score)} text-2xl`}>
                {Math.round(score)}
              </div>
              <div className="text-sm text-neutral-300">
                Overall livability score based on recent heat, hazards, population pressure, and air quality proxy.
              </div>
            </div>
          )}
          {(metrics.healthBadge || metrics.floodBadge) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {metrics.healthBadge && (
                <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs" title="Derived from Heat Index risk category.">
                  Health: {metrics.healthBadge}
                </span>
              )}
              {metrics.floodBadge && (
                <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs" title="Recent flood signals from nearby EONET events.">
                  Flood: {metrics.floodBadge}
                </span>
              )}
            </div>
          )}
        </Card>

        <Card>
          <div className="text-neutral-300 font-medium mb-3">Key Metrics</div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded border border-neutral-800 bg-neutral-900 p-3">
                  <div className="h-3 w-24 bg-neutral-800 rounded" />
                  <div className="h-5 w-16 bg-neutral-800 rounded mt-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Current Heat Index" value={metrics.currentHeatIndexF !== undefined ? `${Math.round(metrics.currentHeatIndexF)} °F` : (metrics.heatIndexF !== undefined ? `${Math.round(metrics.heatIndexF)} °F` : undefined)} hint={`Realtime 'feels like' heat using temperature and humidity${metrics.currentHeatIndexSource ? ` (source: ${metrics.currentHeatIndexSource})` : ''}.`} />
              <Metric label="Max Heat Index (24h)" value={metrics.maxHeatIndex24hF !== undefined ? `${Math.round(metrics.maxHeatIndex24hF)} °F` : undefined} hint="Highest heat index observed over the last 24 hours (UTC)." />
              <Metric label="Recent hot days (7d)" value={metrics.recentHotDays} hint="Number of days with dangerous heat index in the last week." />
              <Metric label="Population density" value={metrics.populationDensity !== undefined ? `${Math.round(metrics.populationDensity)} ppl/km²` : undefined} hint="People per square kilometer (SEDAC GPW)." />
              <Metric label="Nearby hazards (100 km)" value={metrics.nearbyHazards?.count ?? 0} hint="Open events from NASA EONET within 100 km." />
              <Metric label="Air quality proxy" value={metrics.airQualityProxy !== undefined ? metrics.airQualityProxy : undefined} hint="Derived from nearby smoke/dust/volcanic signals." />
              <Metric label="Air quality (PM2.5/AQI)" value={metrics.airNow?.aqiUS !== undefined ? `AQI ${metrics.airNow.aqiUS}${metrics.airNow.pm25 !== undefined ? ` • ${metrics.airNow.pm25} µg/m³` : ''}` : undefined} hint="Nearest OpenAQ observation (latest)." />
            </div>
          )}
          {metrics.nearbyHazards?.categories && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(metrics.nearbyHazards.categories).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs">
                  <b>{k}</b>
                  <span className="text-neutral-400">{v}</span>
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="text-neutral-300 font-medium mb-3">What this means</div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 w-full bg-neutral-800 rounded" />
              ))}
            </div>
          ) : (
            <ul className="list-disc ml-5 mt-1 space-y-1 text-sm">
              {advice.length ? advice.map((a, i) => <li key={i}>{a}</li>) : <li>No specific advisories for this location right now.</li>}
            </ul>
          )}
          <div className="text-xs text-neutral-500 mt-3">
            Sources: NASA POWER (heat), EONET (hazards), SEDAC GPW (population). Imagery and greenness via NASA GIBS.
            {adviceSource && (
              <span className="ml-2 text-neutral-400">Narrative source: {adviceSource === 'llm' ? 'AI-generated' : 'Rule-based'}</span>
            )}
          </div>
        </Card>

        {valid && (
          <Card>
            <div className="text-neutral-300 font-medium mb-3">Nearby alternatives</div>
            <div className="text-xs text-neutral-400">Quickly try nearby points to compare conditions.</div>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
              {[{ dLat: 0.2, dLon: 0, label: "North ~22km" }, { dLat: -0.2, dLon: 0, label: "South ~22km" }, { dLat: 0, dLon: 0.2, label: "East ~22km" }, { dLat: 0, dLon: -0.2, label: "West ~22km" }, { dLat: 0.15, dLon: 0.15, label: "NE ~30km" }, { dLat: -0.15, dLon: -0.15, label: "SW ~30km" }].map((o) => (
                <li key={o.label}>
                  <Link className="underline text-sky-400" href={`/result?lat=${(lat + o.dLat).toFixed(5)}&lon=${(lon + o.dLon).toFixed(5)}`}>{o.label}</Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {valid && (
          <Card>
            <div className="text-neutral-300 font-medium mb-3">Ask AI about this place</div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm"
                placeholder="e.g., Is it safe to run outside in the afternoon?"
                value={qa?.q ?? ''}
                onChange={(e) => setQa({ q: e.target.value, a: qa?.a ?? '' })}
              />
              <button
                disabled={!(qa?.q) || loading}
                onClick={async () => {
                  if (!qa?.q) return;
                  setQa({ q: qa.q, a: '', loading: true });
                  try {
                    const res = await fetch('/api/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ question: qa.q, lat, lon, context: metrics })
                    });
                    const j = await res.json();
                    if (!res.ok) {
                      const detail = typeof j?.detail === 'string' ? j.detail : '';
                      const errMsg = [j?.error || 'AI error', detail].filter(Boolean).join(': ');
                      setQa({ q: qa.q, a: '', error: errMsg.slice(0, 800), loading: false });
                    } else {
                      setQa({ q: qa.q, a: j?.answer ?? 'No answer', loading: false });
                    }
                  } catch {
                    setQa({ q: qa.q, a: '', error: 'Error contacting AI service.', loading: false });
                  }
                }}
                className="px-3 py-2 rounded bg-emerald-600 disabled:bg-neutral-700 hover:bg-emerald-500 text-sm font-medium"
              >Ask</button>
            </div>
            {qa?.error && (
              <div className="mt-3 text-sm text-red-400">{qa.error}</div>
            )}
            {qa?.a && (
              <div className="mt-3 text-sm text-neutral-200 whitespace-pre-wrap">{qa.a}</div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6 sm:p-10 bg-neutral-950 text-neutral-400">Loading results…</div>}>
      <ResultInner />
    </Suspense>
  );
}
