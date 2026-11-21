import type { CommerceCommands } from './commerce-commands';
import { FixtureCommerceAdapter } from './fixture-commerce-adapter';

// Global singleton adapter across Next.js dev server modules and HMR re-evaluations
const globalForCommerce = globalThis as unknown as {
  smartTijoriCommerceAdapter?: CommerceCommands;
};

export function getCommerceCommands(): CommerceCommands {
  if (globalForCommerce.smartTijoriCommerceAdapter) {
    return globalForCommerce.smartTijoriCommerceAdapter;
  }

  // Fixtures are permitted only for explicit demo runs or unit/HTTP tests.
  // Unconfigured live routes must fail rather than simulate a successful stock mutation.
  if (process.env.SMARTTIJORI_DEMO_MODE !== 'true' && process.env.NODE_ENV !== 'test') {
    throw new Error('Authoritative commerce commands are not configured for this runtime');
  }

  const fixtureAdapter = new FixtureCommerceAdapter();
  globalForCommerce.smartTijoriCommerceAdapter = fixtureAdapter;
  return fixtureAdapter;
}

/**
 * For testing: inject a custom or recording adapter
 */
export function setCommerceCommands(adapter: CommerceCommands | null): void {
  globalForCommerce.smartTijoriCommerceAdapter = adapter ?? undefined;
}
