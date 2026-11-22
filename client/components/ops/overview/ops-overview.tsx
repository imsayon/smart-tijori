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
    <div className="space-y-6">
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
    </div>
  );
}
