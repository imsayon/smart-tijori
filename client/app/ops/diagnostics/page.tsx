import { createPipelineReader } from '@server/events/diagnostics';
import { getCommerceDatabase } from '@server/db/runtime';
import { readWorkbenchOperator } from '../operator';

export const metadata = { title: 'Pipeline Diagnostics | SmartTijori' };

export default async function OpsDiagnosticsPage() {
  const { actor, fixture } = await readWorkbenchOperator();
  if (!actor?.storeId) return null;
  if (fixture) return <p>Pipeline diagnostics require the live PostgreSQL event store.</p>;

  const facts = await createPipelineReader(getCommerceDatabase())(actor.storeId);
  const metrics = [
    ['Pending events', facts.pendingCount],
    ['Oldest pending event', facts.oldestPendingAt],
    ['Last Kafka acknowledgment', facts.lastBrokerAckAt],
    ['Last projection accepted', facts.lastProjectionAcceptedAt],
    ['Projection retries', facts.projectionRetryCount],
    ['Quarantined events', facts.quarantineCount],
    ['Last error', facts.lastError?.code],
  ] as const;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Pipeline &amp; Worker Diagnostics</h1>
      <p className="text-sm">{facts.storeId} · Checked <time dateTime={facts.checkedAt}>{facts.checkedAt}</time></p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {metrics.map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4">
          <dt className="text-sm font-medium">{label}</dt><dd className="font-mono">{value ?? 'None recorded'}</dd>
        </div>)}
      </dl>
      <h2 className="text-lg font-bold">Recent events</h2>
      {facts.recentEvents.length ? <ul className="space-y-1 text-sm">
        {facts.recentEvents.map(event => <li key={event.eventId}>
          {event.type} · {event.publishedAt ? 'Acknowledged' : 'Pending'} · <time dateTime={event.occurredAt}>{event.occurredAt}</time>
        </li>)}
      </ul> : <p className="text-sm">No events recorded.</p>}
    </section>
  );
}
