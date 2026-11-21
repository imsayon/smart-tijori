import React from 'react';
import type { Metadata } from 'next';
import { OpsShell } from '@/components/ops/layout/ops-shell';
import { AccessLayout } from '@/components/ops/layout/access-layout';
import { getCommerceDatabase } from '@server/db/runtime';
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
  const branchName = actor?.storeId && !fixture ? await getCommerceDatabase().transact(async client => {
    const { rows } = await client.query<{ name: string }>('SELECT name FROM stores WHERE id = $1', [actor.storeId]);
    return rows[0]?.name;
  }) : undefined;
  return <OpsShell operator={actor} fixture={fixture} branchName={branchName}>{actor ? children : <AccessLayout merchant />}</OpsShell>;
}
