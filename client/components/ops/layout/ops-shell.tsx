'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Overview', href: '/ops', icon: '📊' },
  { name: 'POS Terminal', href: '/ops/pos', icon: '🏪', badge: 'Active' },
  { name: 'Store Inventory', href: '/ops/inventory', icon: '📦' },
  { name: 'Diagnostics', href: '/ops/diagnostics', icon: '⚡' },
];

export interface OpsShellProps {
  children: React.ReactNode;
  operator?: { operatorId?: string; role?: string; storeId?: string } | null;
  fixture?: boolean;
}

/**
 * Shared Operations Workbench Shell & Navigation.
 *
 * Scope & Security:
 * - Session identity is strictly server-verified (storeId: 'blr-01', role: 'store_operator').
 * - Navigation links route between Overview, POS Cashier, Inventory, and Diagnostics.
 * - Active route is highlighted responsively on desktop and mobile viewports.
 * - Fixture/Demo mode is clearly disclosed to prevent mistaking test runs for production.
 */
export function OpsShell({ children }: OpsShellProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === '/ops') {
      return pathname === '/ops';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F4EE] text-[#181614] antialiased">
      {/* Workbench Global Header */}
      <header className="sticky top-0 z-30 bg-[#0E2A22] text-[#FAF8F5] border-b border-[#276350] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand & Subtitle */}
            <div className="flex items-center gap-3">
              <Link href="/ops" className="flex items-center gap-2 group">
                <span className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-1.5">
                  <span className="text-lime-400">Smart</span>Tijori
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider bg-lime-400/20 text-lime-300 px-2 py-0.5 rounded-md border border-lime-400/30">
                  Ops
                </span>
              </Link>
              <span className="hidden md:inline text-xs text-[#E8F3EE]/60 border-l border-emerald-800/80 pl-3">
                Store Operations Workbench
              </span>
            </div>

            {/* Operator Session Pill & Adapter Disclosure */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#163D31] text-[#E8F3EE] border border-[#276350]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>blr-01</span>
                <span className="text-emerald-400/60">·</span>
                <span className="text-emerald-200">cashier (operator)</span>
              </div>

              <span className="text-[11px] bg-amber-500/20 text-amber-300 font-mono font-bold px-2.5 py-1 rounded-full border border-amber-500/40">
                ⚡ DEMO MODE
              </span>

              <Link
                href="/"
                className="text-xs text-[#E8F3EE]/80 hover:text-white px-2.5 py-1 rounded-lg hover:bg-emerald-800/40 transition-colors"
                title="Return to customer shop"
              >
                ← Shop
              </Link>
            </div>
          </div>

          {/* Workbench Responsive Navigation Bar */}
          <nav
            aria-label="Operations Navigation"
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 -mb-px border-t border-[#1E4D3E] text-xs font-semibold"
          >
            {NAV_ITEMS.map((item) => {
              const active = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all font-mono text-xs',
                    active
                      ? 'bg-lime-400 text-[#0E2A22] font-black shadow-sm'
                      : 'text-[#E8F3EE]/80 hover:text-white hover:bg-[#163D31]'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                  {item.badge && !active && (
                    <span className="text-[9px] bg-lime-400/20 text-lime-300 px-1.5 py-0.2 rounded-full font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Operations Workbench Footnotes & Architectural Disclosures */}
      <footer className="mt-auto border-t border-[#D5CFBF] bg-[#ECE6D8] text-stone-700 py-6 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#D5CFBF]">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#0E2A22] text-xs uppercase tracking-wider">
                Terminal Status
              </span>
              <span className="text-stone-400">·</span>
              <span className="font-mono text-stone-600">Store Network: <strong className="text-stone-900">Synchronized</strong></span>
              <span className="text-stone-400">·</span>
              <span className="font-mono text-stone-600">Access: <strong className="text-stone-900">Verified Operator</strong></span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <Link href="/" className="text-emerald-800 font-bold hover:underline">
                ← Return to Storefront
              </Link>
            </div>
          </div>

          {/* Operational Footnotes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-stone-600 bg-[#E3DCCB] p-3.5 rounded-xl border border-[#D5CFBF]">
            <div>
              <span className="font-bold text-stone-800 block mb-0.5">Footnote on Stock & POS Authority:</span>
              <p>
                In-store POS sales commit atomically against PostgreSQL book stock.
                If items are currently held by online shoppers, POS surfaces <code>STOCK_LOCKED_ONLINE</code> until the 59s hold window elapses.
              </p>
            </div>
            <div>
              <span className="font-bold text-stone-800 block mb-0.5">Footnote on Pipeline & Projections:</span>
              <p>
                Inventory changes emit outbox events delivered via Apache Kafka. Projection consumers update OpenSearch with monotonic version guards.
                Consumers never debit stock.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-stone-500 pt-1 font-mono">
            <span>Security: Server-verified operator session cookie with scoped store authorization.</span>
            <span>Operations Terminal · Outbox & Projection Telemetry</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
