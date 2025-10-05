"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Suggestion = {
  id: string | number;
  name: string;
  lat: number;
  lon: number;
};

export default function SearchBox({
  onSelect,
  placeholder = "Search city or address",
}: {
  onSelect: (s: Suggestion) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!q.trim()) { setItems([]); setOpen(false); return; }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=6`);
        const data = await res.json();
        const arr = Array.isArray(data?.results) ? data.results : [];
        setItems(arr);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [q]);

  function pick(s: Suggestion) {
    setQ(s.name);
    setOpen(false);
    onSelect(s);
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 pr-10"
      />
      <div className="absolute right-2 top-2 text-neutral-400 text-xs">
        {loading ? '…' : '↵'}
      </div>
      {open && items.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-neutral-900 border border-neutral-700 rounded shadow-lg max-h-64 overflow-auto">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-sm"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
