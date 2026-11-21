import React from 'react';
import type { Metadata } from 'next';
import { DiagnosticsView } from '@/components/ops/diagnostics/diagnostics-view';

export const metadata: Metadata = {
  title: 'Pipeline Diagnostics | Operations Workbench',
  description: 'Asynchronous event projection telemetry, Kafka broker acknowledgments, and outbox lag monitor.',
};

/**
 * Operations Diagnostics page mounted at /ops/diagnostics.
 * Renders the read-only DiagnosticsView component conforming to PipelineFacts.
 */
export default function OpsDiagnosticsPage() {
  return <DiagnosticsView />;
}
