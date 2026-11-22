'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Global Shopper Footer & Operational Disclosures.
 *
 * Scope & Features:
 * - Brand identity, branch presence (Bengaluru & Mysuru), and quick navigation.
 * - Architectural and operational footnotes disclosing PostgreSQL single-stock allocation,
 *   59-second checkout reservation holds, and simulated payment gateway.
 * - Direct links to Store Operations Workbench (/ops), POS cashier, inventory, and diagnostics.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-[#F5F1E8] text-stone-700">
      {/* Top Value / Guarantee Banner */}
      <div className="border-b border-stone-200/80 bg-[#ECE6D8]/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-stone-600">
          <div className="flex items-start gap-3">
            <span className="text-xl">⏱️</span>
            <div>
              <p className="font-bold text-stone-900">59-Second Real-Time Holds</p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Checkout locks items for 59s to guarantee availability without blocking shelf stock.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl">🏪</span>
            <div>
              <p className="font-bold text-stone-900">Hyperlocal Branches</p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Authoritative local inventory direct from Indiranagar (Bengaluru) and Gokulam (Mysuru).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl">🛡️</span>
            <div>
              <p className="font-bold text-stone-900">Single-Stock Invariant</p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                PostgreSQL alone allocates stock. No overselling or phantom inventory.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl">⚡</span>
            <div>
              <p className="font-bold text-stone-900">Simulated Payments</p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Safe demo checkout environment. Immediate simulated confirmation receipt.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1: Brand & Overview */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-[#173F35] flex items-center gap-1">
                <span className="text-emerald-700">Smart</span>Tijori
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#173F35] text-white px-2 py-0.5 rounded-md">
                Storefront
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              SmartTijori is a neighborhood retail system combining high-concurrency online shopper
              storefronts with in-store physical POS terminals and real-time inventory management.
            </p>
            <div className="pt-2 text-xs font-mono text-stone-600">
              <span className="block font-semibold text-stone-800">Operational Hours:</span>
              <span>Mon – Sun: 7:00 AM – 10:00 PM IST</span>
            </div>
          </div>

          {/* Column 2: Shopper Storefront Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-900">
              Shopper Storefront
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-[#173F35] hover:underline transition-colors">
                  Browse Product Catalog
                </Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-[#173F35] hover:underline transition-colors">
                  Typo-Tolerant Search
                </Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-[#173F35] hover:underline transition-colors">
                  Shopping Cart & Holds
                </Link>
              </li>
              <li>
                <Link href="/stores" className="hover:text-[#173F35] hover:underline transition-colors">
                  Select Neighborhood Store
                </Link>
              </li>
              <li>
                <Link href="/interest" className="hover:text-[#173F35] hover:underline transition-colors">
                  Out-of-Stock Demand Registry
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Store Operations Workbench */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-900">
              Operations & Systems
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/ops" className="hover:text-[#173F35] hover:underline font-semibold text-emerald-800 transition-colors">
                  📊 Operations Workbench
                </Link>
              </li>
              <li>
                <Link href="/ops/pos" className="hover:text-[#173F35] hover:underline transition-colors">
                  🏪 Cashier POS Terminal
                </Link>
              </li>
              <li>
                <Link href="/ops/inventory" className="hover:text-[#173F35] hover:underline transition-colors">
                  📦 Store Inventory Monitor
                </Link>
              </li>
              <li>
                <Link href="/ops/diagnostics" className="hover:text-[#173F35] hover:underline transition-colors">
                  ⚡ Pipeline Telemetry & Outbox
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Neighborhood Branches */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-900">
              Active Store Hubs
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="bg-stone-100/70 p-2.5 rounded-xl border border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">Bengaluru Branch</span>
                  <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    blr-01
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  12th Main Road, Indiranagar, Bengaluru
                </p>
              </div>

              <div className="bg-stone-100/70 p-2.5 rounded-xl border border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">Mysuru Branch</span>
                  <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    mys-01
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  Temple Road, Vani Vilas Mohalla / Gokulam, Mysuru
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Footnotes & Technical Disclosures */}
        <div className="mt-8 pt-6 border-t border-stone-300/80">
          <div className="rounded-2xl bg-[#EFEADF] p-4 text-[11px] text-stone-600 space-y-2 border border-stone-300/60">
            <div className="flex items-start gap-2">
              <span className="font-bold text-stone-800 shrink-0">Footnote on Stock & Holds:</span>
              <span>
                Checkout reserves items for exactly 59 seconds via PostgreSQL row-level locks. If payment confirmation
                is not completed before expiration, the reservation is released back to online shoppers and in-store cashiers.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-stone-800 shrink-0">Footnote on Payments:</span>
              <span>
                This is a live prototype with simulated payment transactions. No financial transactions, debit/credit cards,
                or banking credentials are requested or stored.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-stone-800 shrink-0">Footnote on Architecture:</span>
              <span>
                Domain events stream to Apache Kafka via transactional outbox relay with monotonic version guards in OpenSearch.
                PostgreSQL remains the sole allocation authority.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-Footer Bar */}
      <div className="border-t border-stone-300 bg-[#E8E2D5] px-4 sm:px-6 lg:px-8 py-4 text-xs text-stone-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-800">SmartTijori · Bengaluru and Mysuru</span>
            <span>·</span>
            <span>Demo store · Simulated payments</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online (Postgres · Kafka · OpenSearch)</span>
            </div>
            <span className="text-stone-500 text-[11px]">
              © {new Date().getFullYear()} SmartTijori
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
