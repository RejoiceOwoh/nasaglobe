import { NextRequest, NextResponse } from "next/server";

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = (Math.PI / 180) * (b.lat - a.lat);
  const dLon = (Math.PI / 180) * (b.lon - a.lon);
  const lat1 = (Math.PI / 180) * a.lat;
  const lat2 = (Math.PI / 180) * b.lat;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// NOAA Heat Index approximation
function heatIndexF(tF: number, rh: number) {
  const T = tF, R = rh;
  const c1 = -42.379, c2 = 2.04901523, c3 = 10.14333127, c4 = -0.22475541, c5 = -0.00683783, c6 = -0.05481717, c7 = 0.00122874, c8 = 0.00085282, c9 = -0.00000199;
  let HI = c1 + c2*T + c3*R + c4*T*R + c5*T*T + c6*R*R + c7*T*T*R + c8*T*R*R + c9*T*T*R*R;
  // Adjustments
  if (R < 13 && T >= 80 && T <= 112) HI -= ((13 - R)/4) * Math.sqrt((17 - Math.abs(T - 95))/17);
  if (R > 85 && T >= 80 && T <= 87) HI += ((R - 85)/10) * ((87 - T)/5);
  return HI;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Invalid lat/lon" }, { status: 400 });
  }

  try {
    const notes: string[] = [];
    const today = new Date();
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const end = fmt(y);
    const start = fmt(new Date(y.getTime() - 6*24*60*60*1000));

    // POWER API: daily temps and RH (approx via T2M_MIN/MAX and RH2M)
    const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,RH2M&start=${start}&end=${end}&latitude=${lat}&longitude=${lon}&community=AG&format=JSON`;

    // EONET events within ~1 degree box (about ~100km at equator)
    const eonetUrl = `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200`;

    // SEDAC WMS GetFeatureInfo for population density (2020) at the point
    const sedacBase = `https://sedac.ciesin.columbia.edu/geoserver/wms`;
    const bbox = `${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}`; // small box around point
    const sedacParams = new URLSearchParams({
      service: 'WMS', request: 'GetFeatureInfo', version: '1.3.0',
      layers: 'gpw-v4:gpw-v4-population-density_2020',
      query_layers: 'gpw-v4:gpw-v4-population-density_2020',
      info_format: 'application/json',
      crs: 'EPSG:4326',
      bbox,
      width: '101', height: '101',
      i: '50', j: '50',
      styles: ''
    });
    const sedacUrl = `${sedacBase}?${sedacParams.toString()}`;

    // Helper: fetch with timeout and safe JSON parsing
  async function fetchJson(url: string, timeoutMs = 9000): Promise<unknown | null> {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        if (!res.ok) return null;
        const text = await res.text();
        try { return JSON.parse(text); } catch { return null; }
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    }

    const [powerJson, eonetJson, sedacJson] = await Promise.all([
      fetchJson(powerUrl),
      fetchJson(eonetUrl),
      fetchJson(sedacUrl),
    ]);
    if (!powerJson) notes.push('POWER unavailable; some heat metrics may be approximate.');
    if (!eonetJson) notes.push('EONET unavailable; hazards may be undercounted.');
    if (!sedacJson) notes.push('SEDAC unavailable; population density omitted.');

    type PowerResponse = { properties?: { parameter?: { T2M_MAX?: Record<string, number>; RH2M?: Record<string, number> } } };
    type EonetResponse = { events?: Array<{ categories?: Array<{ title?: string }>; geometry?: Array<{ type: string; coordinates: [number, number] }> }> };
    type SedacFeatureCollection = { features?: Array<{ properties?: Record<string, number> }> };

    const power = (powerJson || null) as PowerResponse | null;
    const eonet = (eonetJson || null) as EonetResponse | null;
    const sedac = (sedacJson || null) as SedacFeatureCollection | null;

    // POWER parse
  const days = power?.properties?.parameter?.T2M_MAX ? Object.keys(power.properties.parameter.T2M_MAX) : [];
    const lastKey = days[days.length - 1];
    let heatIndexFVal: number | undefined;
    let recentHotDays = 0;
    if (lastKey) {
  const tmaxC = power!.properties!.parameter!.T2M_MAX![lastKey]!;
  const rh = power!.properties!.parameter!.RH2M?.[lastKey] ?? 50;
      const tF = tmaxC * 9/5 + 32;
      heatIndexFVal = heatIndexF(tF, rh);
      // rough count of days with heat index > 100F in window
      for (const k of days) {
  const tC = power!.properties!.parameter!.T2M_MAX![k]!;
  const rhD = power!.properties!.parameter!.RH2M?.[k] ?? 50;
        const tFD = tC * 9/5 + 32;
        if (heatIndexF(tFD, rhD) > 100) recentHotDays++;
      }
    }

    // EONET nearby hazards count within 100 km (and air-quality proxy within 300 km)
  type EonetEvent = { id: string; title: string; link?: string; categories?: { id?: string; title: string }[]; geometry?: { type: string; coordinates: [number, number] }[] };
  const events: EonetEvent[] = Array.isArray(eonet?.events) ? (eonet!.events as EonetEvent[]) : [];
    let hazardCount = 0;
    let nearestKm: number | undefined;
    const categories: Record<string, number> = {};
  let aqPenalty = 0; // accumulate penalties for air quality proxy
    for (const ev of events) {
      const g = ev.geometry?.[ev.geometry.length - 1];
      if (!g || g.type !== 'Point') continue;
      const [elon, elat] = g.coordinates;
      const d = haversineKm({ lat, lon }, { lat: elat, lon: elon });
      if (d <= 100) {
        hazardCount++;
        nearestKm = nearestKm === undefined ? d : Math.min(nearestKm, d);
        const cat = ev.categories?.[0]?.title ?? 'Other';
        categories[cat] = (categories[cat] || 0) + 1;
      }
      // Air quality proxy penalties for smoke/dust emitting hazards
      const catTitle = ev.categories?.[0]?.title ?? '';
      if (catTitle === 'Wildfires') {
        if (d <= 100) aqPenalty += 30; else if (d <= 300) aqPenalty += 15;
      } else if (catTitle === 'Dust and Haze') {
        if (d <= 150) aqPenalty += 20; else if (d <= 300) aqPenalty += 10;
      } else if (catTitle === 'Volcanoes') {
        if (d <= 150) aqPenalty += 15; else if (d <= 300) aqPenalty += 8;
      }
    }

  // Air quality proxy (0 bad -> 100 good), start from 95 and subtract capped penalties
  const airQualityProxy = Math.max(0, Math.min(100, Math.round(95 - Math.min(60, aqPenalty))));

    // SEDAC population density value
    let popDensity: number | undefined;
    try {
  const feat = sedac?.features?.[0];
      const val = feat?.properties?.GRAY_INDEX ?? feat?.properties?.gridcode ?? feat?.properties?.DN;
      if (typeof val === 'number') popDensity = val;
    } catch {
      // ignore
    }

    // scoring
    // components: heat burden (0-40), hazards proximity (0-30), population pressure (0-20), baseline (10)
  let score = 10;
  const advice: string[] = [];

    if (heatIndexFVal !== undefined) {
      const hi = heatIndexFVal;
      const heatScore = hi < 85 ? 40 : hi < 95 ? 30 : hi < 105 ? 20 : hi < 115 ? 10 : 5;
      score += heatScore;
      if (hi >= 100) advice.push("High heat: prioritize shade, hydration, and indoor cooling mid-day.");
      if (recentHotDays >= 3) advice.push("Multiple extreme heat days recently—consider evening outdoor activity.");
    } else {
      score += 25; // neutral
    }

    if (hazardCount > 0) {
      const hazScore = hazardCount === 0 ? 30 : hazardCount < 3 ? 20 : hazardCount < 6 ? 10 : 5;
      score += hazScore;
      advice.push(`Nearby hazards detected (${hazardCount} in 100 km). Stay informed on local advisories.`);
      if (nearestKm !== undefined && nearestKm < 20) advice.push("A recent hazard was reported within 20 km—check municipal alerts.");
    } else {
      score += 28;
    }

    if (popDensity !== undefined) {
      // lower density slightly preferred for quiet; clamp 0-20000
      const pd = Math.min(20000, Math.max(0, popDensity));
      const densityScore = pd < 1000 ? 20 : pd < 3000 ? 15 : pd < 7000 ? 10 : pd < 12000 ? 6 : 3;
      score += densityScore;
      if (pd > 7000) advice.push("Dense area—expect more traffic and noise; prioritize indoor air quality.");
    } else {
      score += 12;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    // AI-style narrative (rule-based summarizer)
  const narrative: string[] = [];
    if (heatIndexFVal !== undefined) {
      if (heatIndexFVal >= 105) narrative.push("Severe heat burden detected. Expect hazardous mid-day conditions; prioritize indoor cooling and hydration.");
      else if (heatIndexFVal >= 95) narrative.push("Elevated heat conditions likely; plan outdoor activities for mornings/evenings.");
      else narrative.push("Heat levels appear manageable for typical outdoor activities.");
    }
    if (hazardCount > 0) {
      const nearTxt = nearestKm !== undefined ? ` The nearest recent event is about ${Math.round(nearestKm)} km away.` : '';
      const cats = Object.entries(categories).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${k.toLowerCase()} (${v})`).join(', ');
      narrative.push(`Recent hazards nearby: ${hazardCount} in the last window, mostly ${cats || 'varied types'}.${nearTxt}`);
    } else {
      narrative.push("No recent hazard activity detected within 100 km.");
    }
    if (typeof popDensity === 'number') {
      if (popDensity > 10000) narrative.push("This area is very dense—expect urban noise, traffic, and fewer green buffers.");
      else if (popDensity > 3000) narrative.push("Moderate-to-high density suggests good access to services with some crowding.");
      else narrative.push("Lower density may offer quieter living with more open space.");
    }
    if (typeof airQualityProxy === 'number') {
      if (airQualityProxy < 40) narrative.push("Air quality risks are elevated due to nearby smoke/dust sources—consider indoor air filtration.");
      else if (airQualityProxy < 70) narrative.push("Mild air quality concerns are possible; check daily conditions if sensitive.");
      else narrative.push("Air quality signals look favorable at this time.");
    }
    if (notes.length) narrative.push(...notes.map(n => `Note: ${n}`));

    const payload = {
      input: { lat, lon },
      metrics: {
        heatIndexF: heatIndexFVal,
        recentHotDays,
        populationDensity: popDensity,
        nearbyHazards: { count: hazardCount, nearestKm, categories },
        airQualityProxy,
      },
      score,
      advice: (advice.length ? advice : ["No major concerns detected from recent Earth observation indicators."]).concat(narrative)
    };

    return NextResponse.json(payload, { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=600' } });
  } catch {
    // Last-resort fallback: never 500
    return NextResponse.json({
      input: { lat, lon },
      metrics: {},
      score: 50,
      advice: [
        'Temporary data issue: returning a neutral score.',
        'Try again in a moment; upstream services may be slow.'
      ]
    });
  }
}
