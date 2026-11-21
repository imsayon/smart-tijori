import type { Metadata } from 'next';
import { CashierWorkspace } from '@/components/ops/cashier/cashier-workspace';
import { readWorkbenchOperator } from '../operator';

export const metadata: Metadata = {
  title: 'Cashier Counter | SmartTijori',
  description: 'Scan barcodes, complete counter purchases, and see branch availability.',
};

export default async function CashierPage() {
  const { actor, fixture } = await readWorkbenchOperator();
  if (!actor?.storeId) return null;
  return <CashierWorkspace storeId={actor.storeId} operatorId={actor.operatorId} fixture={fixture}/>;
}
