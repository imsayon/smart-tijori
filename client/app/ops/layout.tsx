import React from 'react';
import type { Metadata } from 'next';
import { OpsShell } from '@/components/ops/layout/ops-shell';
import { OperatorAccess } from '@/components/ops/layout/operator-access';
import { readWorkbenchOperator } from './operator';

export const metadata: Metadata = {
  title: 'Operations Workbench | SmartTijori',
  description: 'In-store operations terminal, real-time inventory facts, and event pipeline diagnostics.',
};

/**
 * Nested layout for all /ops/* routes.
 * Provides unified navigation, operator status disclosure, and responsive shell.
 */
export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actor, fixture } = await readWorkbenchOperator();
  return <OpsShell operator={actor} fixture={fixture}>{actor ? children : <OperatorAccess />}</OpsShell>;
}
