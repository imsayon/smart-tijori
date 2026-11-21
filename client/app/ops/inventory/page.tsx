import React from 'react';
import type { Metadata } from 'next';
import { InventoryView } from '@/components/ops/inventory/inventory-view';

export const metadata: Metadata = {
  title: 'Store Inventory Monitoring | Operations Workbench',
  description: 'Real-time per-SKU inventory visibility, stock-on-hand, online holds, and stock movement ledger.',
};

/**
 * Operations Inventory Monitor page mounted at /ops/inventory.
 * Renders the read-only InventoryView component conforming to OpsFacts.
 */
export default function OpsInventoryPage() {
  return <InventoryView />;
}
