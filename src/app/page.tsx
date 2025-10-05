'use client'

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import SearchBox from "../components/SearchBox";
import FeaturedCities from "../components/FeaturedCities";

const MapClient = dynamic(() => import("../components/MapClient"), { ssr: false });

// (results moved to /result)


export default function Home() {
  const [lat, setLat] = useState<number | ''>('');
  const [lon, setLon] = useState<number | ''>('');
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);
  const [routing, setRouting] = useState(false);
  const router = useRouter();
  const [showTrueColor, setShowTrueColor] = useState(true);
  const [showNdvi, setShowNdvi] = useState(true);
  const [base, setBase] = useState<'osm' | 'satellite' | 'humanitarian' | 'streets'>('osm');

  const canScore = useMemo(() => typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon), [lat, lon]);

  function parseNum(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  }

  async function useMyLocation() {
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
    setRouting(true);
    router.push(`/result?lat=${lat}&lon=${lon}`);
  }

  // results are displayed on /result page now

  return (
    <div className="min-h-screen p-6 sm:p-10 grid gap-6 bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between">
  <h1 className="text-lg sm:text-2xl font-semibold">Eco-Safe — NASA Liveability Advisor</h1>
        <div className="text-xs text-neutral-400">POWER • EONET • SEDAC • GIBS</div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/60">
          <div className="flex flex-col gap-3">
            <SearchBox
              placeholder="Search city or address"
              onSelect={(s) => {
                setLat(Number(s.lat.toFixed(5)));
                setLon(Number(s.lon.toFixed(5)));
                setPicked({ lat: s.lat, lon: s.lon });
              }}
            />
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
                disabled={!canScore || routing}
                className="px-3 py-2 rounded bg-emerald-600 disabled:bg-neutral-700 hover:bg-emerald-500 text-sm font-medium"
              >
                {routing ? "Loading results…" : "Score this location"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300 mt-3">
            <div className="inline-flex items-center gap-2">
              Base:
              <select
                value={base}
                onChange={(e) => setBase(e.target.value as 'osm' | 'streets' | 'satellite' | 'humanitarian')}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs"
              >
                <option value="osm">OpenStreetMap</option>
                <option value="streets">Streets (Carto)</option>
                <option value="satellite">Satellite (Esri)</option>
                <option value="humanitarian">Humanitarian</option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={showTrueColor} onChange={() => setShowTrueColor(v=>!v)} /> True Color
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={showNdvi} onChange={() => setShowNdvi(v=>!v)} /> NDVI (greenery)
            </label>
          </div>
          <div className="h-[420px] mt-2 rounded overflow-hidden border border-neutral-800">
            <MapClient
              picked={picked}
              onPick={(pt) => {
                setLat(Number(pt.lat.toFixed(5)));
                setLon(Number(pt.lon.toFixed(5)));
                setPicked(pt);
              }}
              overlays={{ trueColor: showTrueColor, ndvi: showNdvi }}
              base={base}
            />
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Pick on map, paste coordinates, or use your device location. Zoom and click to set point.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/60">
        <h2 className="font-semibold mb-2">Discover cities</h2>
        <div className="text-sm text-neutral-400">Curated places to explore. Click any to score it instantly.</div>
        <FeaturedCities />
      </section>
    </div>
  );
}
