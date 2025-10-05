import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 400 });
    }
  const body = await req.json().catch(() => ({}));
  const { question, lat, lon, context, history, purpose }: { question?: string; lat?: number; lon?: number; context?: unknown; history?: Array<{ role: 'user'|'assistant'|'system'; content: string }>; purpose?: 'qa' | 'explain' } = body || {};
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }

    const sysQa = `You are an assistant that answers questions about a location using NASA Earth observation context. Be concise, factual, and practical. Prefer referencing: heat (POWER/Open-Meteo), recent hazards (EONET), air quality (OpenAQ/proxy), population, and any provided now metrics. Be clear about data limits.`;
    const sysExplain = `You are an assistant that explains the 'What this means' section in more detail for a location, grounded in the provided metrics. Produce a skimmable breakdown with 5–9 bullets and one short paragraph. Be specific, neutral, and practical.`;
    const sys = purpose === 'explain' ? sysExplain : sysQa;

    const baseUser = `Lat: ${lat}\nLon: ${lon}\nContext: ${JSON.stringify(context || {}, null, 2)}`;
    const user = purpose === 'explain'
      ? `Explain these results in more detail for a general audience. Focus on heat, hazards, air quality, and population context.\n${baseUser}`
      : `Question: ${question}\n${baseUser}`;

    // removed obsolete single-call helper

    const primaryModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const thread: Array<{ role: 'system'|'user'|'assistant'; content: string }> = [{ role: 'system', content: sys }];
    if (Array.isArray(history)) {
      for (const m of history.slice(-10)) {
        if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
          thread.push({ role: m.role, content: m.content });
        }
      }
    }
    thread.push({ role: 'user', content: user });

    async function callWithMessages(model: string): Promise<Response> {
      return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: thread,
          temperature: purpose === 'explain' ? 0.4 : 0.3,
          max_tokens: purpose === 'explain' ? 500 : 300,
        })
      });
    }

    let res: Response = await callWithMessages(primaryModel);
    let provider: 'openai' | 'groq' = 'openai';
    if (!res.ok) {
      const t1 = await res.text();
      // Try OpenAI fallback(s)
      const fallbackModel1 = primaryModel !== 'gpt-3.5-turbo' ? 'gpt-3.5-turbo' : 'gpt-4o-mini';
      res = await callWithMessages(fallbackModel1);
      if (!res.ok) {
        const t2 = await res.text();
        const fallbackModel2 = 'gpt-4o-mini';
        res = await callWithMessages(fallbackModel2);
        if (!res.ok) {
          const t3 = await res.text();
          // Try Groq if available
          const gk = process.env.GROQ_API_KEY;
          if (gk) {
            const groqModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
            const gres = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gk}` },
              body: JSON.stringify({
                model: groqModel,
                messages: thread,
                temperature: purpose === 'explain' ? 0.4 : 0.3,
                max_tokens: purpose === 'explain' ? 500 : 300,
              })
            });
            if (!gres.ok) {
              const tg = await gres.text();
              const detail = (tg || t3 || t2 || t1) ? (tg || t3 || t2 || t1).slice(0, 1200) : 'Unknown error';
              return NextResponse.json({ error: 'OpenAI/Groq error', detail }, { status: 500 });
            }
            provider = 'groq';
            res = gres;
          } else {
            const detail = (t3 || t2 || t1) ? (t3 || t2 || t1).slice(0, 1200) : 'Unknown error';
            return NextResponse.json({ error: 'OpenAI error', detail }, { status: 500 });
          }
        }
      }
    }
    type ChatResponse = { choices?: Array<{ message?: { content?: string } }> };
    const j: ChatResponse = await res.json();
    const content = j?.choices?.[0]?.message?.content || 'No answer generated.';
    return NextResponse.json({ answer: content, provider });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: 'Unexpected error', detail: msg }, { status: 500 });
  }
}
