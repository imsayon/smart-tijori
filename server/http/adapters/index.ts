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

  // In test environment or development demo mode, use the FixtureCommerceAdapter
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
