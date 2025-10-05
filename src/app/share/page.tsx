export const dynamic = 'force-static';

export default function SharePage() {
  return (
    <div className="min-h-screen p-6 sm:p-10 bg-neutral-950 text-neutral-100">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold">Share input about your location</h1>
        <p className="text-sm text-neutral-400 mt-1">Your insights help others. Submissions go to our inbox securely.</p>
        <form
          action="https://submit-form.com/2g6oZ1Z2"
          method="POST"
          className="mt-6 space-y-3"
        >
          <input type="hidden" name="_redirect" value="/thanks" />
          <input type="hidden" name="_email.to" value="rejoicecorporations@gmail.com" />
          <input type="hidden" name="_email.template.title" value="New Eco-Safe Location Input" />
          <input type="hidden" name="_email.subject" value="Eco-Safe community input" />
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Your name</label>
            <input name="name" required className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Latitude</label>
              <input name="latitude" type="text" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Longitude</label>
              <input name="longitude" type="text" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Location name (city, area)</label>
            <input name="location" className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Your input</label>
            <textarea name="message" required rows={6} className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="Share tips about heat, air, flood, safe routes, and local knowledge." />
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">Submit</button>
            <span className="text-xs text-neutral-500">Powered by submit-form.com</span>
          </div>
        </form>
      </div>
    </div>
  );
}
