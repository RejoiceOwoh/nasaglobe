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

  // POWER API: hourly (UTC) for near-realtime T2M and RH2M over last ~48h (yesterday + today)
  const todayUTC = new Date();
  const endH = fmt(new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate())));
  const startH = fmt(new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate() - 1)));
  const powerHourlyUrl = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,RH2M&start=${startH}&end=${endH}&latitude=${lat}&longitude=${lon}&community=AG&time-standard=UTC&format=JSON`;

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

    const [powerJson, powerHourlyJson, eonetJson, sedacJson] = await Promise.all([
      fetchJson(powerUrl),
      fetchJson(powerHourlyUrl),
      fetchJson(eonetUrl),
      fetchJson(sedacUrl),
    ]);
    if (!powerJson) notes.push('POWER daily unavailable; some heat metrics may be approximate.');
    if (!powerHourlyJson) notes.push('POWER hourly unavailable; using latest daily heat surrogate.');
    if (!eonetJson) notes.push('EONET unavailable; hazards may be undercounted.');
    if (!sedacJson) notes.push('SEDAC unavailable; population density omitted.');

  type PowerResponse = { properties?: { parameter?: { T2M_MAX?: Record<string, number>; RH2M?: Record<string, number> } } };
  type PowerHourlyResponse = { properties?: { parameter?: { T2M?: Record<string, number>; RH2M?: Record<string, number> } } };
    type EonetResponse = { events?: Array<{ categories?: Array<{ title?: string }>; geometry?: Array<{ type: string; coordinates: [number, number] }> }> };
    type SedacFeatureCollection = { features?: Array<{ properties?: Record<string, number> }> };
  type OpenMeteoCurrent = { temperature_2m?: number; relative_humidity_2m?: number; apparent_temperature?: number; wind_speed_10m?: number; wind_gusts_10m?: number; precipitation?: number; cloud_cover?: number; uv_index?: number; time?: string };
    type OpenMeteoResponse = { current?: OpenMeteoCurrent };
    type OpenAQMeasurement = { parameter?: string; value?: number; unit?: string; lastUpdated?: string };
    type OpenAQResult = { measurements?: OpenAQMeasurement[]; date?: { utc?: string } };
    type OpenAQLatestResponse = { results?: OpenAQResult[] };

  const power = (powerJson || null) as PowerResponse | null;
  const powerHourly = (powerHourlyJson || null) as PowerHourlyResponse | null;
    const eonet = (eonetJson || null) as EonetResponse | null;
    const sedac = (sedacJson || null) as SedacFeatureCollection | null;

    // Reverse geocoding (settlement type) for universal coverage
    async function reverseGeocode(lat: number, lon: number): Promise<{ name?: string; class?: string; type?: string } | null> {
      try {
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('lat', String(lat));
        url.searchParams.set('lon', String(lon));
        url.searchParams.set('zoom', '10');
        url.searchParams.set('addressdetails', '0');
        const res = await fetch(url.toString(), {
          headers: {
            'User-Agent': 'nasaglobe/1.0 (NASA Space Apps demo)',
            'Accept': 'application/json'
          },
          cache: 'no-store'
        });
        if (!res.ok) return null;
        const j = await res.json();
        return { name: j?.name || j?.display_name, class: j?.class, type: j?.type };
      } catch {
        return null;
      }
    }
    const settlement = await reverseGeocode(lat, lon);

    // POWER parse
  const days = power?.properties?.parameter?.T2M_MAX ? Object.keys(power.properties.parameter.T2M_MAX) : [];
    const lastKey = days[days.length - 1];
  let heatIndexFVal: number | undefined;
  let currentHeatIndexF: number | undefined;
  let currentHeatIndexSource: 'open-meteo' | 'power-hourly' | 'power-daily' | undefined;
  let maxHeatIndex24hF: number | undefined;
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

    // POWER hourly: compute current and 24h max Heat Index if available
    try {
      const t2m = powerHourly?.properties?.parameter?.T2M || null;
      const rh2m = powerHourly?.properties?.parameter?.RH2M || null;
      if (t2m) {
        const keys = Object.keys(t2m).sort(); // 'YYYYMMDDHH'
        if (keys.length) {
          const last24 = keys.slice(-24);
          let maxHI = -Infinity;
          for (const k of last24) {
            const tC = t2m[k];
            const rh = rh2m?.[k] ?? 50;
            const tF = tC * 9/5 + 32;
            const hi = heatIndexF(tF, rh);
            if (hi > maxHI) maxHI = hi;
          }
          if (Number.isFinite(maxHI)) maxHeatIndex24hF = Math.round(maxHI);
          const lastKeyH = keys[keys.length - 1];
          if (lastKeyH) {
            const tC = t2m[lastKeyH];
            const rh = rh2m?.[lastKeyH] ?? 50;
            currentHeatIndexF = heatIndexF(tC * 9/5 + 32, rh);
            currentHeatIndexSource = 'power-hourly';
          }
        }
      }
    } catch {
      // ignore hourly parse errors
    }

    // Open-Meteo current weather as realtime fallback/augment
    let omCurrent: OpenMeteoCurrent | undefined;
    try {
      const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover,uv_index&timezone=UTC`;
      const omJson = await fetchJson(omUrl, 8000) as unknown as OpenMeteoResponse | null;
      const cur = omJson?.current ?? null;
      if (cur && typeof cur === 'object') {
        omCurrent = {
          temperature_2m: typeof cur.temperature_2m === 'number' ? cur.temperature_2m : undefined,
          relative_humidity_2m: typeof cur.relative_humidity_2m === 'number' ? cur.relative_humidity_2m : undefined,
          apparent_temperature: typeof cur.apparent_temperature === 'number' ? cur.apparent_temperature : undefined,
          wind_speed_10m: typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : undefined,
          wind_gusts_10m: typeof (cur as OpenMeteoCurrent).wind_gusts_10m === 'number' ? (cur as OpenMeteoCurrent).wind_gusts_10m : undefined,
          precipitation: typeof (cur as OpenMeteoCurrent).precipitation === 'number' ? (cur as OpenMeteoCurrent).precipitation : undefined,
          cloud_cover: typeof (cur as OpenMeteoCurrent).cloud_cover === 'number' ? (cur as OpenMeteoCurrent).cloud_cover : undefined,
          uv_index: typeof (cur as OpenMeteoCurrent).uv_index === 'number' ? (cur as OpenMeteoCurrent).uv_index : undefined,
          time: typeof cur.time === 'string' ? cur.time : undefined,
        };
      }
    } catch {
      // ignore
    }

    let currentHeatIndexF_om: number | undefined;
    if (omCurrent?.temperature_2m !== undefined && omCurrent?.relative_humidity_2m !== undefined) {
      const tF = (omCurrent.temperature_2m as number) * 9/5 + 32;
      const rh = omCurrent.relative_humidity_2m as number;
      // Use NOAA HI for hotter temps; otherwise treat HI as temperature proxy
      currentHeatIndexF_om = tF >= 80 ? heatIndexF(tF, rh) : tF;
    }

    if (currentHeatIndexF_om !== undefined) {
      currentHeatIndexF = currentHeatIndexF_om;
      currentHeatIndexSource = 'open-meteo';
    } else if (currentHeatIndexF !== undefined) {
      currentHeatIndexSource = currentHeatIndexSource || 'power-hourly';
    } else if (heatIndexFVal !== undefined) {
      currentHeatIndexSource = 'power-daily';
    }

    // EONET nearby hazards count within 100 km (and air-quality proxy within 300 km)
  type EonetEvent = { id: string; title: string; link?: string; categories?: { id?: string; title: string }[]; geometry?: { type: string; coordinates: [number, number] }[] };
  const events: EonetEvent[] = Array.isArray(eonet?.events) ? (eonet!.events as EonetEvent[]) : [];
    let hazardCount = 0;
    let nearestKm: number | undefined;
    const categories: Record<string, number> = {};
  let aqPenalty = 0; // accumulate penalties for air quality proxy
    let recentFlood = false;
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
        if (cat === 'Floods') recentFlood = true;
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

    // OpenAQ: real-time PM2.5 near the point
  let airNow: { pm25?: number; aqiUS?: number; observedAt?: string } | undefined;
    function pm25ToUSAQI(c: number): number {
      // US EPA AQI breakpoints for PM2.5 (24h) - using NowCast-like mapping approximation
      const bp = [
        { cLo: 0.0, cHi: 12.0, iLo: 0, iHi: 50 },
        { cLo: 12.1, cHi: 35.4, iLo: 51, iHi: 100 },
        { cLo: 35.5, cHi: 55.4, iLo: 101, iHi: 150 },
        { cLo: 55.5, cHi: 150.4, iLo: 151, iHi: 200 },
        { cLo: 150.5, cHi: 250.4, iLo: 201, iHi: 300 },
        { cLo: 250.5, cHi: 350.4, iLo: 301, iHi: 400 },
        { cLo: 350.5, cHi: 500.4, iLo: 401, iHi: 500 },
      ];
      for (const b of bp) {
        if (c >= b.cLo && c <= b.cHi) {
          return Math.round(((b.iHi - b.iLo) / (b.cHi - b.cLo)) * (c - b.cLo) + b.iLo);
        }
      }
      return 500;
    }
    try {
      const oq = (radiusKm: number) => `https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=${Math.round(radiusKm*1000)}&parameter=pm25&order_by=datetime&sort=desc&limit=1`;
      let oqJson = await fetchJson(oq(50), 8000) as unknown as OpenAQLatestResponse | null;
      if ((!oqJson || !oqJson.results || !oqJson.results.length)) {
        oqJson = await fetchJson(oq(100), 8000) as unknown as OpenAQLatestResponse | null;
      }
      const first: OpenAQResult | undefined = oqJson?.results?.[0];
      const measurement: OpenAQMeasurement | undefined = first?.measurements?.find((m) => m.parameter === 'pm25') || first?.measurements?.[0];
      const pm = typeof measurement?.value === 'number' ? measurement.value : undefined;
      const dt = typeof measurement?.lastUpdated === 'string' ? measurement.lastUpdated : first?.date?.utc;
      if (pm !== undefined) {
        airNow = { pm25: pm, aqiUS: pm25ToUSAQI(pm), observedAt: dt };
      }
    } catch {
      // ignore OpenAQ failures
    }

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

    const drivingHI = (currentHeatIndexF !== undefined ? currentHeatIndexF : (heatIndexFVal !== undefined ? heatIndexFVal : undefined));
    if (drivingHI !== undefined) {
      const hi = drivingHI;
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

    // Badges
    let healthBadge: string | undefined;
    if (drivingHI !== undefined) {
      if (drivingHI >= 115) healthBadge = 'Extreme heat risk';
      else if (drivingHI >= 105) healthBadge = 'Very high heat risk';
      else if (drivingHI >= 95) healthBadge = 'High heat risk';
      else if (drivingHI >= 85) healthBadge = 'Moderate heat risk';
      else healthBadge = 'Low heat risk';
    }
    const floodBadge = recentFlood ? 'Recent flood nearby' : undefined;

  // AI-style narrative (rule-based summarizer, optionally enhanced by OpenAI if key provided)
  const narrative: string[] = [];
    if (settlement?.type) {
      const t = settlement.type;
      if (['city', 'town'].includes(t)) narrative.push('This location appears urban with access to services and higher activity.');
      else if (['village', 'hamlet', 'isolated_dwelling'].includes(t)) narrative.push('This location appears rural—expect quieter surroundings and longer travel times to services.');
    }
    if (drivingHI !== undefined) {
      if (drivingHI >= 105) narrative.push("Severe heat burden detected. Expect hazardous mid-day conditions; prioritize indoor cooling and hydration.");
      else if (drivingHI >= 95) narrative.push("Elevated heat conditions likely; plan outdoor activities for mornings/evenings.");
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
    if (airNow?.aqiUS !== undefined) {
      if (airNow.aqiUS >= 151) narrative.push("Air quality is currently unhealthy—limit outdoor exertion and consider a mask or purifier.");
      else if (airNow.aqiUS >= 101) narrative.push("Air quality is moderate to unhealthy for sensitive groups—check local advisories if sensitive.");
    }
    if (notes.length) narrative.push(...notes.map(n => `Note: ${n}`));

    // Optional LLM enhancement
    let llmAdvice: string[] | null = null;
    try {
      const key = process.env.OPENAI_API_KEY;
      if (key) {
        const sys = 'You are a concise housing liveability advisor using NASA Earth data. Write 3-6 bullet points: actionable, neutral tone, avoid absolutes. Include specific references to heat, hazards, density, and air quality proxy. Keep each bullet under 25 words.';
        const user = JSON.stringify({ lat, lon, score, metrics: { heatIndexF: heatIndexFVal, currentHeatIndexF, currentHeatIndexSource, maxHeatIndex24hF, recentHotDays, hazardCount, nearestKm, categories, populationDensity: popDensity, airQualityProxy, airNow } });
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: `Create bullet guidance for this location data: ${user}` }
            ],
            temperature: 0.4,
            max_tokens: 200
          })
        });
        if (res.ok) {
          type ChatResponse = { choices?: Array<{ message?: { content?: string } }> };
          const j: ChatResponse = await res.json();
          const content: string = j?.choices?.[0]?.message?.content || '';
          if (content) {
            // Split into bullets by line
            llmAdvice = content
              .split(/\n|\r/)
              .map((s: string) => s.replace(/^[-*\s]+/, '').trim())
              .filter((s: string) => s.length > 0)
              .slice(0, 6);
          }
        }
      }
    } catch {
      // ignore LLM errors; fallback to rule-based narrative only
    }

    const payload = {
      input: { lat, lon },
  metrics: {
  heatIndexF: heatIndexFVal,
  currentHeatIndexF: currentHeatIndexF !== undefined ? Math.round(currentHeatIndexF) : undefined,
  currentHeatIndexSource,
  maxHeatIndex24hF,
        recentHotDays,
        populationDensity: popDensity,
        nearbyHazards: { count: hazardCount, nearestKm, categories },
    airQualityProxy,
    airNow,
        now: omCurrent,
        settlement,
        healthBadge,
        floodBadge,
      },
      score,
      advice: (llmAdvice && llmAdvice.length ? llmAdvice : (advice.length ? advice : ["No major concerns detected from recent Earth observation indicators."]))
        .concat(narrative),
      adviceSource: llmAdvice && llmAdvice.length ? 'llm' : 'rule'
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
