"use client";

import Link from "next/link";
import Image from "next/image";

type City = {
  name: string;
  country?: string;
  lat: number;
  lon: number;
  tone?: "good" | "mixed" | "caution";
  img?: string;
};

const CITIES: City[] = [
  { name: "Reykjavík", country: "Iceland", lat: 64.1466, lon: -21.9426, tone: "good", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=75&auto=format" },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lon: 4.9041, tone: "good", img: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=870&auto=format" },
  { name: "Nairobi", country: "Kenya", lat: -1.286389, lon: 36.817223, tone: "mixed", img: "https://images.unsplash.com/photo-1596005554384-d293674c91d7?q=80&w=898&auto=format" },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lon: 3.3792, tone: "mixed", img: "https://images.unsplash.com/photo-1618828665011-0abd973f7bb8?q=80&w=1032&auto=format" },
  { name: "New York", country: "USA", lat: 40.7128, lon: -74.006, tone: "mixed", img: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=75&auto=format" },
  { name: "Dubai", country: "UAE", lat: 25.2048, lon: 55.2708, tone: "caution", img: "https://images.unsplash.com/photo-1504270997636-07ddfbd48945?w=800&q=75&auto=format" },
  { name: "Delhi", country: "India", lat: 28.7041, lon: 77.1025, tone: "caution", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?q=80&w=870&auto=format" },
  { name: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333, tone: "mixed", img: "https://images.unsplash.com/photo-1572894234976-d961418c709d?q=80&w=435&auto=format" },
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
          {c.img && (
            <Image
              src={c.img}
              alt={c.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              className="object-cover opacity-70 group-hover:opacity-80 transition-opacity"
              priority={false}
            />
          )}
          <div className="absolute inset-0 bg-neutral-950/30" />
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
