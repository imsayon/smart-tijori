import { DiagnosticsView } from '@/components/ops/diagnostics/diagnostics-view';
import { createPipelineReader } from '@server/events/diagnostics';
import { getCommerceDatabase } from '@server/db/runtime';
import { readWorkbenchOperator } from '../operator';

export const metadata = { title: 'Pipeline Diagnostics | SmartTijori' };

export default async function Page() {
  const { actor, fixture } = await readWorkbenchOperator();
  if (!actor?.storeId) return null;
  if (fixture) return <p>Pipeline Diagnostics requires a PostgreSQL connection.</p>;
  const db = getCommerceDatabase();
  const facts = await createPipelineReader(db)(actor.storeId);
  return <DiagnosticsView storeId={actor.storeId} initialFacts={facts} />;
}
