import { InventoryView } from '@/components/ops/inventory/inventory-view';
import { createCommerceFacts } from '@server/commerce/facts';
import { getCommerceDatabase } from '@server/db/runtime';
import { readWorkbenchOperator } from '../operator';

export const metadata = { title: 'Inventory | SmartTijori' };

export default async function Page() {
  const { actor, fixture } = await readWorkbenchOperator();
  if (!actor?.storeId) return null;
  if (fixture) return <p>Inventory requires a PostgreSQL connection.</p>;
  const db = getCommerceDatabase();
  const facts = await createCommerceFacts(db).readOpsFacts(actor.storeId);
  return <InventoryView storeId={actor.storeId} initialFacts={facts} canRestock />;
}
