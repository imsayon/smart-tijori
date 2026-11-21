import React from 'react';

export function Footer() {
  return (
    <footer className="bg-[#F5F1E8] border-t border-stone-200 text-stone-700 mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 className="font-bold text-base text-[#173F35] mb-2">SmartTijori Omnichannel</h4>
            <p className="text-stone-600 text-xs leading-relaxed">
              Modern neighborhood retail connecting counter and web with atomic PostgreSQL inventory authority, CartLock reservations, and ZeroDeadEnd recovery.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-base text-[#173F35] mb-2">Participating Stores</h4>
            <ul className="text-stone-600 text-xs space-y-1">
              <li>📍 SmartTijori Bengaluru — Koramangala (blr-01)</li>
              <li>📍 SmartTijori Mysuru — Saraswathipuram (mys-01)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-base text-[#173F35] mb-2">Evaluation Environment</h4>
            <div className="bg-white/80 p-3 rounded-lg border border-stone-300 text-xs text-stone-600">
              <p className="font-semibold text-emerald-900">DEMO &amp; TEST ENVIRONMENT</p>
              <p className="text-[11px] text-stone-500 mt-1">
                Curated 24 pantry and household products. Payments and hardware are simulated.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-stone-200 text-center text-xs text-stone-500">
          © 2026 SmartTijori · Srujan Web Application Module · Built for Build Bengaluru Hackathon
        </div>
      </div>
    </footer>
  );
}
