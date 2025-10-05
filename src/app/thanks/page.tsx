export const dynamic = 'force-static';

import Link from 'next/link';

export default function ThanksPage() {
  return (
    <div className="min-h-screen p-6 sm:p-10 bg-neutral-950 text-neutral-100 grid place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Thank you for your input</h1>
        <p className="text-neutral-400 mt-2">We appreciate your contribution to the Eco-Safe community.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/" className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-sm">Back home</Link>
          <Link href="/result" className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm">Score a location</Link>
        </div>
      </div>
    </div>
  );
}
