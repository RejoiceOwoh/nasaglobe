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

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: 'OpenAI error', detail: t.slice(0, 400) }, { status: 500 });
    }
    type ChatResponse = { choices?: Array<{ message?: { content?: string } }> };
    const j: ChatResponse = await res.json();
    const content = j?.choices?.[0]?.message?.content || 'No answer generated.';
    return NextResponse.json({ answer: content });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
