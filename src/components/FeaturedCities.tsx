"use client";

import Link from "next/link";

type City = {
  name: string;
  country?: string;
  lat: number;
  lon: number;
  tone?: "good" | "mixed" | "caution";
};

const CITIES: City[] = [
  { name: "Reykjavík", country: "Iceland", lat: 64.1466, lon: -21.9426, tone: "good" },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lon: 4.9041, tone: "good" },
  { name: "Nairobi", country: "Kenya", lat: -1.286389, lon: 36.817223, tone: "mixed" },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lon: 3.3792, tone: "mixed" },
  { name: "New York", country: "USA", lat: 40.7128, lon: -74.006, tone: "mixed" },
  { name: "Dubai", country: "UAE", lat: 25.2048, lon: 55.2708, tone: "caution" },
  { name: "Delhi", country: "India", lat: 28.7041, lon: 77.1025, tone: "caution" },
  { name: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333, tone: "mixed" },
];

function toneStyles(tone?: City["tone"]) {
  switch (tone) {
    case "good":
      return "from-emerald-600/40 to-emerald-400/20 border-emerald-600/40";
    case "caution":
      return "from-orange-600/40 to-orange-400/20 border-orange-600/40";
    default:
      return "from-sky-600/40 to-sky-400/20 border-sky-600/40";
  }
}

export default function FeaturedCities() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
      {CITIES.map((c) => (
        <Link
          key={`${c.name}-${c.lat}`}
          href={`/result?lat=${c.lat}&lon=${c.lon}`}
          className={`relative h-24 rounded-lg border bg-gradient-to-br ${toneStyles(c.tone)} overflow-hidden group`}
        >
          <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity" />
          <div className="absolute bottom-2 left-2 right-2">
            <div className="text-sm font-medium">{c.name}</div>
            {c.country && (
              <div className="text-[11px] text-neutral-300">{c.country}</div>
            )}
          </div>
          {c.tone && (
            <span
              className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-neutral-900/70 border border-neutral-700"
              title={
                c.tone === "good"
                  ? "Generally favorable signals"
                  : c.tone === "caution"
                  ? "Heat/hazard or air quality caution"
                  : "Mixed signals"
              }
            >
              {c.tone}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
