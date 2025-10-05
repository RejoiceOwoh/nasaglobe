import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

// Server-side proxy to forward multipart submissions to formsubmit.co
// Advantages: avoids client-side CORS/blocks, allows timeouts/retries, and returns unified JSON errors
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    // Basic validation
    const name = form.get('name');
    const email = form.get('email');
    const message = form.get('message');
    if (!name || !email || !message) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, email, message.' }, { status: 400 });
    }

    // Total attachment size guard (approximate)
    const files = form.getAll('attachments').filter((v): v is File => v instanceof File);
    const totalBytes = files.reduce((sum, f) => sum + (typeof f.size === 'number' ? f.size : 0), 0);
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (totalBytes > maxBytes) {
      return NextResponse.json({ success: false, error: 'Attachments exceed 5MB total. Please reduce file sizes and try again.' }, { status: 413 });
    }

    // Ensure _replyto is set to sender email for formsubmit
  const replyTo = typeof email === 'string' ? email : String(email || '');
    if (replyTo) {
      form.set('_replyto', replyTo);
    }

    // Build forwarding FormData (clone all fields)
    const fwd = new FormData();
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        fwd.append(key, value, value.name);
      } else {
        fwd.append(key, String(value));
      }
    }

    // Send to formsubmit.co with a conservative timeout
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch('https://formsubmit.co/ajax/rejoicecorporations@gmail.com', {
        method: 'POST',
        body: fwd,
        headers: { 'Accept': 'application/json' },
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        // Surface limited details to user
        const snippet = text ? text.slice(0, 800) : 'Unknown error';
        return NextResponse.json({ success: false, error: `Submission failed (${res.status}). ${snippet}` }, { status: 502 });
      }
      // Try JSON parse but don't require it
  type Json = unknown;
  let data: Json = null;
  try { data = JSON.parse(text) as Json; } catch {}
  return NextResponse.json({ success: true, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      const detail = msg.includes('aborted') ? 'Upstream timeout. Please try again.' : msg;
      return NextResponse.json({ success: false, error: `Network error while forwarding submission. ${detail}` }, { status: 504 });
    } finally {
      clearTimeout(t);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
