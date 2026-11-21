import React from 'react';
import type { Metadata } from 'next';
import { OpsOverview } from '@/components/ops/overview/ops-overview';

export const metadata: Metadata = {
  title: 'Operations Overview | SmartTijori Workbench',
  description: 'Operations control overview, terminal status, inventory monitoring, and pipeline diagnostics.',
};

/**
 * Operations Overview landing page mounted at /ops.
 * Renders the OpsOverview component bringing together inventory and pipeline facts.
 */
export default function OpsOverviewPage() {
  return <OpsOverview />;
}
