import React from 'react';
import type { Metadata } from 'next';
import { OpsShell } from '@/components/ops/layout/ops-shell';

export const metadata: Metadata = {
  title: 'Operations Workbench | SmartTijori',
  description: 'In-store operations terminal, real-time inventory facts, and event pipeline diagnostics.',
};

/**
 * Nested layout for all /ops/* routes.
 * Provides unified navigation, operator status disclosure, and responsive shell.
 */
export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OpsShell>{children}</OpsShell>;
}
