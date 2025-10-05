export const dynamic = 'force-static';

export default function ListingsPage() {
  const listings = [
    { id: 1, title: '2BR Apartment — Green District', city: 'Lagos', score: 86, badges: ['Low heat risk', 'Air quality good'], img: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop' },
    { id: 2, title: 'Townhouse — Coastal Breeze', city: 'Accra', score: 78, badges: ['Moderate heat', 'Flood-safe zone'], img: 'https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1200&auto=format&fit=crop' },
    { id: 3, title: 'Studio — Downtown Core', city: 'Nairobi', score: 73, badges: ['Near parks', 'Transit access'], img: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=1200&auto=format&fit=crop' },
  ];
  return (
    <div className="min-h-screen p-6 sm:p-10 bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold">Verified listings</h1>
        <p className="text-sm text-neutral-400 mt-1">Homes meeting objective environmental and safety criteria. Coming soon — partner submissions and verification.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {listings.map((l) => (
            <div key={l.id} className="rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 hover:bg-neutral-900/80 transition">
              <div className="aspect-video bg-neutral-800" style={{ backgroundImage: `url(${l.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div className="p-4">
                <div className="text-neutral-200 font-medium">{l.title}</div>
                <div className="text-xs text-neutral-400">{l.city}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="px-2 py-1 rounded bg-neutral-800 text-emerald-400 text-xs">Score {l.score}</div>
                  {l.badges.map((b, i) => (
                    <div key={i} className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 text-xs">{b}</div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-xs font-medium">View details</button>
                  <button className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-xs">Contact</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
