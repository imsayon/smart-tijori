import { OpsOverview } from '@/components/ops/overview/ops-overview';
import { createCommerceFacts } from '@server/commerce/facts';
import { createPipelineReader } from '@server/events/diagnostics';
import { getCommerceDatabase } from '@server/db/runtime';
import { readWorkbenchOperator } from './operator';

export const metadata = { title: 'Operations Overview | SmartTijori' };

export default async function OpsOverviewPage() {
  const { actor, fixture } = await readWorkbenchOperator();
  if (!actor?.storeId) return null;
  if (fixture) return <p>Live branch facts require a PostgreSQL connection.</p>;
  const db = getCommerceDatabase();
  const [inventory, pipeline] = await Promise.allSettled([
    createCommerceFacts(db).readOpsFacts(actor.storeId),
    createPipelineReader(db)(actor.storeId),
  ]);
  return (
    <OpsOverview storeId={actor.storeId}
      initialInventoryFacts={inventory.status === 'fulfilled' ? inventory.value : null}
      initialPipelineFacts={pipeline.status === 'fulfilled' ? pipeline.value : null} />
  );
}
