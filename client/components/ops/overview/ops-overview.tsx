'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { OpsFacts, PipelineFacts } from '@/contracts';
import { api } from '@/lib/api-client';
import { AtelierTitle, Icon, type IconName } from '@/components/ui/atelier';

const formatTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

function Fact({ label, value, detail, icon }: { label: string; value?: number; detail: string; icon: IconName }) {
  return (
    <div>
      <dt className="atelier-label">{label}<Icon name={icon} /></dt>
      <dd>{value ?? '—'}</dd>
      <p>{detail}</p>
    </div>
  );
}

export function OpsOverview({
  storeId,
  initialInventoryFacts = null,
  initialPipelineFacts = null,
  fixture = false,
}: {
  storeId?: string;
  initialInventoryFacts?: OpsFacts | null;
  initialPipelineFacts?: PipelineFacts | null;
  fixture?: boolean;
}) {
  const [inventory, setInventory] = useState(initialInventoryFacts);
  const [pipeline, setPipeline] = useState(initialPipelineFacts);
  const [inventoryError, setInventoryError] = useState('');
  const [pipelineError, setPipelineError] = useState('');
  const [loading, setLoading] = useState(false);
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'POS' | 'ORDER' | 'RESTOCK'>('ALL');
  const stock = inventory?.stock;
  const stockAttention = [...(stock ?? [])]
    .sort((a, b) => a.available - b.available || a.productId.localeCompare(b.productId))
    .slice(0, 8);

  async function refresh() {
    setLoading(true);
    const [stockResult, pipelineResult] = await Promise.allSettled([api.getOpsInventory(), api.getOpsDiagnostics()]);
    if (stockResult.status === 'fulfilled') {
      setInventory(stockResult.value);
      setInventoryError('');
    } else {
      setInventoryError(stockResult.reason instanceof Error ? stockResult.reason.message : 'Inventory could not be refreshed.');
    }
    if (pipelineResult.status === 'fulfilled') {
      setPipeline(pipelineResult.value);
      setPipelineError('');
    } else {
      setPipelineError(pipelineResult.reason instanceof Error ? pipelineResult.reason.message : 'Activity could not be refreshed.');
    }
    setLoading(false);
  }

  const filteredMovements = inventory?.recentMovements.filter(m => {
    if (movementFilter === 'ALL') return true;
    return m.kind === movementFilter;
  }) ?? [];

  return (
    <div className="os-longscroll space-y-6">
      <AtelierTitle
        lead="A clearer view of"
        accent="commerce."
        context={`Overview${storeId ? ` / ${storeId}` : ''}`}
        description="Stock, online reservations and counter activity for your branch."
        tools={
          <>
            {!fixture && (
              <button
                className="atelier-secondary"
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
              >
                <Icon name="refresh" size={15} />
                {loading ? 'Refreshing…' : 'Refresh facts'}
              </button>
            )}
            <Link className="atelier-action" href="/ops/cashier">
              Open counter <Icon name="arrow" size={15} />
            </Link>
          </>
        }
      />


      <section className="os-hero" aria-labelledby="os-hero-heading">
        <div className="os-hero-copy">
          <p className="os-overline">THE CONNECTED RETAIL WORKSPACE / {fixture ? 'DEMONSTRATION' : 'YOUR BRANCH'}</p>
          <h2 id="os-hero-heading">Every sale.<br /><em>In its place.</em></h2>
          <p>One operational view for the shop floor, online checkout, reservations, and inventory changes. Every reported number below is read for your authorized branch.</p>
          <div className="os-hero-actions">
            <Link href="/ops/cashier" className="os-hero-button">Open counter <Icon name="upRight" size={16}/></Link>
            <Link href="/ops/inventory" className="os-hero-outline">See inventory <Icon name="arrow" size={16}/></Link>
          </div>
        </div>
        <div className="os-hero-art" aria-hidden="true">
          <div className="os-orbit os-orbit-one" />
          <div className="os-orbit os-orbit-two" />
          <div className="os-orbit-core"><span>ST</span></div>
          <div className="os-orbit-tag os-orbit-tag-a">POSTGRESQL <i /></div>
          <div className="os-orbit-tag os-orbit-tag-b">POS + WEB <i /></div>
          <span className="os-orbit-caption">ONE INVENTORY AUTHORITY</span>
        </div>
      </section>

      <dl className="atelier-stats">
        <Fact label="Tracked SKUs" icon="shelf" value={stock?.length} detail="Products at this branch" />
        <Fact label="Available units" icon="package" value={stock?.reduce((sum, item) => sum + item.available, 0)} detail="Available to sell" />
        <Fact label="Stock attention" icon="pulse" value={stock?.filter(item => item.available <= 2).length} detail="SKUs with two or fewer units" />
        <Fact label="Held units" icon="clock" value={stock?.reduce((sum, item) => sum + item.held, 0)} detail="Held by online checkouts" />
      </dl>

      <div className="mt-8 atelier-ops-duo">
        <section className="atelier-panel">
          <header className="atelier-panel-heading">
            <h2>Recent stock movements</h2>
            <Link className="atelier-secondary" href="/ops/inventory">
              Inventory <Icon name="arrow" size={14} />
            </Link>
          </header>

          {inventory?.recentMovements.length ? (
            <div className="atelier-movement-filter" role="tablist" aria-label="Movement types">
              {(['ALL', 'POS', 'ORDER', 'RESTOCK'] as const).map(filter => (
                <button
                  type="button"
                  key={filter}
                  role="tab"
                  aria-current={movementFilter === filter ? 'true' : undefined}
                  onClick={() => setMovementFilter(filter)}
                >
                  {filter === 'ALL' ? 'All' : filter === 'POS' ? 'Counter' : filter === 'ORDER' ? 'Orders' : 'Restocks'}
                </button>
              ))}
            </div>
          ) : null}

          {inventoryError && <p role="alert" className="atelier-empty">{inventoryError}</p>}

          {inventory?.recentMovements.length ? (
            filteredMovements.length ? (
              <ul className="atelier-ledger">
                {filteredMovements.slice(0, 6).map(movement => (
                  <li key={`${movement.referenceId}/${movement.productId}`}>
                    <span>
                      <strong>{movement.productId}</strong>
                      <small>{movement.kind === 'POS' ? 'Counter sale' : movement.kind === 'ORDER' ? 'Online order' : 'Restock'}</small>
                    </span>
                    <time dateTime={movement.occurredAt}>{formatTime.format(new Date(movement.occurredAt))}</time>
                    <b className="font-mono">{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="atelier-empty">No movements match the selected filter.</p>
            )
          ) : (
            <p className="atelier-empty">{inventory ? 'No stock movements recorded.' : 'Branch inventory is unavailable.'}</p>
          )}
        </section>

        <section className="atelier-panel atelier-surface-dark atelier-overview-activity">
          <p className="atelier-label">Activity</p>
          <h2 className="atelier-panel-title">Store updates</h2>
          {pipelineError && <p role="alert">{pipelineError}</p>}
          {pipeline ? (
            <dl>
              <div><dt>Updates waiting to share</dt><dd>{pipeline.pendingCount}</dd></div>
              <div><dt>Last shared update</dt><dd>{pipeline.lastBrokerAckAt ? formatTime.format(new Date(pipeline.lastBrokerAckAt)) : 'No updates yet'}</dd></div>
              <div><dt>Shop availability updated</dt><dd>{pipeline.lastProjectionAcceptedAt ? formatTime.format(new Date(pipeline.lastProjectionAcceptedAt)) : 'No updates yet'}</dd></div>
              {pipeline.lastError && <div><dt>Last recorded issue</dt><dd>{pipeline.lastError.code}</dd></div>}
            </dl>
          ) : (
            <p className="py-4">Activity is unavailable.</p>
          )}
          <Link className="atelier-action" href="/ops/diagnostics">
            View activity <Icon name="arrow" size={15} />
          </Link>
        </section>
      </div>

      <div className="os-section-head">
        <div><p className="atelier-label">INVENTORY / BRANCH HEALTH</p><h2>What needs <em>attention.</em></h2></div>
        <Link href="/ops/inventory" className="atelier-secondary">Full inventory <Icon name="upRight" size={15}/></Link>
      </div>
      <section className="os-stock-panel" aria-label="Stock attention">
        <div className="os-stock-summary">
          <span>PRODUCT</span><span>ON SHELF</span><span>HELD</span><span>AVAILABLE</span><span>STATUS</span>
        </div>
        {stockAttention.length ? stockAttention.map(item => (
          <div className="os-stock-row" key={item.productId}>
            <div><strong>{item.productId}</strong><small>Version {item.inventoryVersion}</small></div>
            <span>{item.stockOnHand}</span><span>{item.held}</span><span>{item.available}</span>
            <span><b className={item.available === 0 ? 'os-status out' : item.available <= 2 ? 'os-status low' : 'os-status'}>
              {item.available === 0 ? 'Out of stock' : item.available <= 2 ? 'Low stock' : 'In stock'}
            </b></span>
          </div>
        )) : (
          <p className="os-stock-empty">{inventory ? 'No inventory is recorded for this branch.' : 'Inventory facts could not be loaded. Refresh when the service is available.'}</p>
        )}
      </section>

      <div className="os-feature-grid">
        <section className="os-hold-feature" aria-labelledby="os-hold-title">
          <span className="os-overline">CARTLOCK / RESERVATIONS</span>
          <h2 id="os-hold-title">The final unit.<br /><em>Protected for checkout.</em></h2>
          <p>An explicit online checkout can hold stock for 59 seconds. A cart does not reserve inventory. POS and online allocations follow the same database rule.</p>
          <div className="os-hold-clock">00:59 <small>MAXIMUM HOLD WINDOW</small></div>
          <Link href="/ops/reservations" className="os-hero-button">View reservations <Icon name="upRight" size={15}/></Link>
          <small className="os-example-note">POLICY REFERENCE · NOT A LIVE RESERVATION COUNTDOWN</small>
        </section>
        <section className="os-workflow-feature" aria-labelledby="os-workflow-title">
          <span className="atelier-label">YOUR STORE / DAY TO DAY</span>
          <h2 id="os-workflow-title">Everything connected.<br /><em>Nothing assumed.</em></h2>
          <div className="os-workflow-links">
            <Link href="/ops/cashier"><Icon name="terminal"/><span><b>Retail counter</b><small>Complete verified in-store sales</small></span><Icon name="upRight" size={14}/></Link>
            <Link href="/ops/inventory"><Icon name="shelf"/><span><b>Stock &amp; restocking</b><small>Reconcile what is available</small></span><Icon name="upRight" size={14}/></Link>
            <Link href="/ops/orders"><Icon name="receipt"/><span><b>Online orders</b><small>Track confirmed transactions</small></span><Icon name="upRight" size={14}/></Link>
            <Link href="/ops/diagnostics"><Icon name="pulse"/><span><b>Activity &amp; diagnostics</b><small>Inspect reliable event processing</small></span><Icon name="upRight" size={14}/></Link>
          </div>
        </section>
      </div>

      <section className="os-architecture" aria-labelledby="os-architecture-title">
        <div className="os-arch-head"><div><p className="os-overline">SYSTEM FOUNDATIONS</p>
          <h2 id="os-architecture-title">One operational <em>truth.</em></h2>
          <p>Stock allocation is decided in PostgreSQL. The event pipeline shares committed changes with dependent services.</p>
        </div><Link href="/ops/diagnostics" className="os-hero-outline">Inspect pipeline <Icon name="arrow" size={15}/></Link></div>
        <ol className="os-arch-flow">
          <li><Icon name="shop" size={25}/><b>Shop + POS</b><small>Commerce requests</small></li>
          <li><Icon name="database" size={25}/><b>PostgreSQL</b><small>Atomic stock &amp; outbox</small></li>
          <li><Icon name="pulse" size={25}/><b>Kafka</b><small>Committed events</small></li>
          <li><Icon name="search" size={25}/><b>Search view</b><small>Derived discovery</small></li>
        </ol>
        <div className="os-arch-foot"><span>ARCHITECTURE REFERENCE · NOT A LIVE HEALTH INDICATOR</span>
          <span>OUTBOX PENDING: {pipeline?.pendingCount ?? '—'} · MOST RECENT ACK: {pipeline?.lastBrokerAckAt ? formatTime.format(new Date(pipeline.lastBrokerAckAt)) : '—'}</span></div>
      </section>
    </div>
  );
}
