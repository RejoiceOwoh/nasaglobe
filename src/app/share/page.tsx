"use client";

import { useState } from "react";

export default function SharePage() {
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function useMyLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        alert(err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="min-h-screen p-6 sm:p-10 bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold">Share input about your location</h1>
        <p className="text-sm text-neutral-400 mt-1">Help others with firsthand insights about heat, air, flooding, and safe living. Your submission goes directly to our inbox.</p>

        <form
          action="#"
          method="post"
          encType="multipart/form-data"
          className="mt-6 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErrorMsg(null);
            setSubmitting(true);
            try {
              if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                throw new Error('You appear to be offline. Please check your internet connection and try again.');
              }
              const formEl = e.currentTarget as HTMLFormElement;
              const fd = new FormData(formEl);
              // Submit to our server-side proxy for better reliability
              const res = await fetch('/api/share', {
                method: 'POST',
                body: fd,
                headers: { 'Accept': 'application/json' },
              });
              if (!res.ok) {
                let detail = '';
                try {
                  const j = await res.json();
                  detail = j?.error || '';
                } catch {
                  const t = await res.text();
                  detail = t;
                }
                const msg = res.status === 413
                  ? 'Attachments exceed the allowed size (5MB total). Please compress or remove some files.'
                  : res.status === 400
                    ? (detail || 'Missing some required fields.')
                    : res.status === 504
                      ? 'Network timeout while sending your submission. Please retry in a moment.'
                      : `Submission failed (${res.status}). ${detail || ''}`;
                setErrorMsg(msg);
                setSubmitting(false);
                return;
              }
              // success → redirect
              window.location.href = '/thanks';
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Network error while submitting.';
              setErrorMsg(msg);
              setSubmitting(false);
            }
          }}
        >
          {/* FormSubmit options */}
          <input type="hidden" name="_next" value="/thanks" />
          <input type="hidden" name="_subject" value="New Eco-Safe community input" />
          <input type="hidden" name="_template" value="table" />
          <input type="hidden" name="_captcha" value="true" />
          <input type="hidden" name="_autoresponse" value="Thanks for sharing your Eco-Safe input. We received your submission and will review it. — Eco-Safe" />
          <input type="text" name="_honey" className="hidden" tabIndex={-1} autoComplete="off" />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Your name</label>
              <input name="name" required className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="Jane Doe" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Email (for reply)</label>
              <input name="email" type="email" required className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="you@example.com" />
              {/* _replyto will be set server-side for reliability */}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-400 mb-1">Location name (city, area, landmark)</label>
              <input name="location" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="e.g., Victoria Island, Lagos" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Country</label>
              <input name="country" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="Nigeria" />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Latitude</label>
              <input name="latitude" value={lat} onChange={(e)=>setLat(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="6.5244" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Longitude</label>
              <input name="longitude" value={lon} onChange={(e)=>setLon(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="3.3792" />
            </div>
            <div>
              <button type="button" onClick={useMyLocation} className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-sm font-medium w-full" disabled={locating}>
                {locating ? 'Getting location…' : 'Use my location'}
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Observations (select all that apply)</label>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-200">
                {['Extreme heat','Poor air quality','Frequent flooding','Dust/Smoke','Noise','Water scarcity','Power outages'].map((t)=> (
                  <label key={t} className="inline-flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-2 py-1">
                    <input type="checkbox" name="tags" value={t} /> {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Time of day</label>
              <select name="time_of_day" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
                {['Morning','Afternoon','Evening','Night'].map((t)=> <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="block text-xs text-neutral-400 mb-1 mt-3">Season</label>
              <select name="season" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
                {['Dry','Rainy','Harmattan','Winter','Summer'].map((t)=> <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Describe your experience</label>
            <textarea name="message" required rows={8} className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="Share details: temperature feel, shade/green cover, air smell/visibility, standing water, safe routes, etc." />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Attach photos (optional)</label>
            <input type="file" name="attachments" accept="image/png, image/jpeg" multiple className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" />
            <div className="text-[11px] text-neutral-500 mt-1">Max total 5MB</div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Phone (optional)</label>
              <input name="phone" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="+234…" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Allow us to contact you?</label>
              <select name="consent_contact" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-emerald-600 disabled:bg-neutral-700 hover:bg-emerald-500 text-sm font-medium">{submitting ? 'Submitting…' : 'Submit'}</button>
            <span className="text-xs text-neutral-500">Powered by formsubmit.co</span>
          </div>
          {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}
          {!errorMsg && submitting && (
            <div className="text-sm text-neutral-400">Sending… If this takes more than ~10s, please retry. Large attachments or network issues can slow things down.</div>
          )}
        </form>
      </div>
    </div>
  );
}
