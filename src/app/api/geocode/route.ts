import { NextRequest, NextResponse } from "next/server";

// Simple geocoding proxy using OpenStreetMap Nominatim
// Note: For hackathon/demo use. For production, consider Mapbox/Google with API keys.
async function nominatimSearch(q: string, limit = 5) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "nasaglobe/1.0 (NASA Space Apps demo)",
      "Accept": "application/json",
      "Referer": "https://space-apps-demo.local",
    },
    // Avoid caching stale results during demo
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Number(searchParams.get('limit') || '6');
    if (!q) return NextResponse.json({ results: [] });

    const results = await nominatimSearch(q, Math.min(10, Math.max(1, limit)));
    type Nom = { place_id: string | number; display_name: string; lat: string; lon: string; type?: string; class?: string; importance?: number };
    const mapped = (results as Nom[]).map((r) => ({
      id: r.place_id,
      name: r.display_name as string,
      lat: Number(r.lat),
      lon: Number(r.lon),
      type: r.type as string,
      class: r.class as string,
      importance: r.importance as number | undefined,
    }));
    return NextResponse.json({ results: mapped }, { headers: { 'Cache-Control': 's-maxage=600' } });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
