'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { OpsFacts } from '@/contracts';
import { api } from '@/lib/api-client';
import { BarcodeSalePanel } from '@/components/ops/pos/barcode-sale-panel';
import { Icon } from '@/components/ui/atelier';

export function CashierWorkspace({ storeId, operatorId, fixture }: {
  storeId: string; operatorId: string; fixture: boolean;
}) {
  const [facts, setFacts] = useState<OpsFacts | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await api.getOpsInventory();
      if (next.storeId !== storeId) throw new Error('Branch selection changed. Refresh your session.');
      setFacts(next);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Store availability is temporarily unavailable.');
    } finally {
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
    const onSale = () => { void refresh(); };
    const onVisible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('smarttijori:stock-updated', onSale);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(onVisible, 20_000);
    return () => {
      window.removeEventListener('smarttijori:stock-updated', onSale);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const units = facts?.stock.reduce((total, item) => total + item.available, 0);
  const held = facts?.stock.reduce((total, item) => total + item.held, 0);
  const low = facts?.stock.filter(item => item.available <= 2).length;

  return <section className="atelier-cashier-desk">
    <div className="atelier-cashier-banner">
      <div>
        <p className="atelier-label">THE COUNTER / YOUR STORE</p>
        <h1 className="atelier-heading">Every sale.<br /><em>Accounted for.</em></h1>
        <p>Scan and sell with confidence. Online checkout holds are respected automatically.</p>
        <div className="atelier-cashier-banner-actions">
          <span className="atelier-cashier-live"><span aria-hidden="true"/>Ready for checkout</span>
          <Link href="/ops/inventory" className="atelier-secondary">Stock overview <Icon name="arrow" size={14}/></Link>
        </div>
      </div>
      <div className="atelier-cashier-seal" aria-hidden="true">
        <svg viewBox="0 0 240 240">
          {Array.from({length: 64}, (_, i) => <path key={i} d="M120 8 V24"
            transform={`rotate(${i*360/64} 120 120)`} stroke="currentColor" strokeWidth="2.8" opacity={i%4===0?1:.65}/>)}
          <circle cx="120" cy="120" r="80" stroke="currentColor" strokeWidth=".8" opacity=".45" fill="none"/>
          <circle cx="120" cy="120" r="62" stroke="currentColor" strokeWidth=".8" opacity=".24" fill="none"/>
          <path d="M90 122 109 140 151 96" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
    <div className="atelier-cashier-stats" aria-label="Current branch availability">
      <div><span>Available units</span><strong>{units ?? '—'}</strong></div>
      <div><span>Units held online</span><strong>{held ?? '—'}</strong></div>
      <div><span>Items needing attention</span><strong>{low ?? '—'}</strong></div>
      <button type="button" className="atelier-secondary" disabled={refreshing} onClick={() => void refresh()}>
        <Icon name="refresh" size={15}/>{refreshing ? 'Updating…' : 'Refresh'}
      </button>
    </div>
    {error && <p role="alert" className="atelier-cashier-warning">{error}</p>}
    <BarcodeSalePanel storeId={storeId} operatorId={operatorId} fixture={fixture}/>
    <p className="atelier-cashier-footnote">A successful counter sale updates your branch stock immediately. Any item reserved for an active online checkout remains unavailable to the counter until released or expired.</p>
  </section>;
}
