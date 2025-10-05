import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const { question, lat, lon, context } = body || {};
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }

    const sys = `You are an assistant that answers questions about a location using NASA Earth observation context. Be concise, factual, and practical. Prefer referencing: heat, recent hazards (EONET), air quality proxy (from smoke/dust/volcano proximity), and population density. Where needed, explain limits. Avoid making up specifics beyond provided context.`;
    const user = `Question: ${question}\nLat: ${lat}\nLon: ${lon}\nContext: ${JSON.stringify(context || {}, null, 2)}`;

    async function call(model: string): Promise<Response> {
      return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user }
          ],
          temperature: 0.3,
          max_tokens: 300
        })
      });
    }

    const primaryModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    let res: Response = await call(primaryModel);
    let provider: 'openai' | 'groq' = 'openai';
    if (!res.ok) {
      const t1 = await res.text();
      // Try OpenAI fallback(s)
      const fallbackModel1 = primaryModel !== 'gpt-3.5-turbo' ? 'gpt-3.5-turbo' : 'gpt-4o-mini';
      res = await call(fallbackModel1);
      if (!res.ok) {
        const t2 = await res.text();
        const fallbackModel2 = 'gpt-4o-mini';
        res = await call(fallbackModel2);
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
                messages: [
                  { role: 'system', content: sys },
                  { role: 'user', content: user }
                ],
                temperature: 0.3,
                max_tokens: 300
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
