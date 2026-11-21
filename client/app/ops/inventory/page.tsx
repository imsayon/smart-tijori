import { createCommerceFacts } from '@server/commerce/facts';
import { getCommerceDatabase } from '@server/db/runtime';
import { readWorkbenchOperator } from '../operator';

export const metadata = { title: 'Store Inventory | SmartTijori' };

export default async function OpsInventoryPage() {
  const { actor, fixture } = await readWorkbenchOperator();
  if (!actor?.storeId) return null;
  if (fixture) return <p>Live inventory is available when the workbench is connected to PostgreSQL.</p>;

  const facts = await createCommerceFacts(getCommerceDatabase()).readOpsFacts(actor.storeId);
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Store Inventory Monitor</h1>
      <p className="text-sm">{facts.storeId} · Checked <time dateTime={facts.checkedAt}>{facts.checkedAt}</time></p>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b">
            {['Product', 'On hand', 'Held', 'Available', 'Version'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}
          </tr></thead>
          <tbody>{facts.stock.map(row => <tr key={row.productId} className="border-b">
            {[row.productId, row.stockOnHand, row.held, row.available, row.inventoryVersion].map((value, index) =>
              <td key={index} className="p-3">{value}</td>
            )}
          </tr>)}</tbody>
        </table>
      </div>
      <h2 className="text-lg font-bold">Recent stock movements</h2>
      {facts.recentMovements.length ? <ul className="space-y-1 text-sm">
        {facts.recentMovements.map((movement, index) => <li key={index}>
          {movement.productId} · {movement.kind} · {movement.quantityDelta} · <time dateTime={movement.occurredAt}>{movement.occurredAt}</time>
        </li>)}
      </ul> : <p className="text-sm">No stock movements recorded.</p>}
    </section>
  );
}
