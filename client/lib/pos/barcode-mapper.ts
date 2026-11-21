/**
 * Standard barcode mapping dictionary for participating POS barcode scanning.
 * Maps EAN-13, UPC, and shelf barcodes to canonical catalog product IDs.
 *
 * All product IDs match the canonical catalog facts defined in server/db/seed.sql
 * and server/discovery/fixtures/catalog-fixture.ts.
 */

export interface BarcodeMapping {
  barcode: string;
  productId: string;
  productName: string;
  format: 'EAN-13' | 'CANONICAL-ST' | 'SHELF-SKU';
}

/**
 * Authoritative mapping verified against canonical seed products.
 */
export const BARCODE_CATALOG: Record<string, { productId: string; name: string }> = {
  // Nilgiri Black Tea 250g (Signature item - 1 unit stock in blr-01 for hold demonstration)
  '8901030383192': { productId: 'tea-250', name: 'Nilgiri Black Tea' },
  'ST:tea-250': { productId: 'tea-250', name: 'Nilgiri Black Tea' },

  // Clear Day Front Load Liquid 1L (Signature item - 1 unit stock in blr-01)
  '8901030383215': { productId: 'detergent-front-1l', name: 'Clear Day Front Load Liquid' },
  'ST:detergent-front-1l': { productId: 'detergent-front-1l', name: 'Clear Day Front Load Liquid' },

  // Sona Masuri Rice 1kg
  '8901030383123': { productId: 'rice-1kg', name: 'Sona Masuri Rice' },
  'ST:rice-1kg': { productId: 'rice-1kg', name: 'Sona Masuri Rice' },

  // Toor Dal 500g
  '8901030383147': { productId: 'dal-500', name: 'Toor Dal' },
  'ST:dal-500': { productId: 'dal-500', name: 'Toor Dal' },

  // Sunflower Cooking Oil 1L
  '8901030383161': { productId: 'oil-1l', name: 'Sunflower Cooking Oil' },
  'ST:oil-1l': { productId: 'oil-1l', name: 'Sunflower Cooking Oil' },

  // Filter Coffee 100g
  '8901030383185': { productId: 'coffee-100', name: 'Filter Coffee' },
  'ST:coffee-100': { productId: 'coffee-100', name: 'Filter Coffee' },

  // Lime Dishwash Liquid 500ml
  '8901030383208': { productId: 'dish-liquid-500', name: 'Lime Dishwash Liquid' },
  'ST:dish-liquid-500': { productId: 'dish-liquid-500', name: 'Lime Dishwash Liquid' },

  // Assam Black Tea 500g
  'ST:tea-500': { productId: 'tea-500', name: 'Assam Black Tea' },

  // Sona Masuri Rice 5kg Family Pack
  '8901030383130': { productId: 'rice-5kg', name: 'Sona Masuri Rice Family Pack' },
  'ST:rice-5kg': { productId: 'rice-5kg', name: 'Sona Masuri Rice Family Pack' },

  // Toor Dal 1kg Family Pack
  '8901030383154': { productId: 'dal-1kg', name: 'Toor Dal Family Pack' },
  'ST:dal-1kg': { productId: 'dal-1kg', name: 'Toor Dal Family Pack' },

  // Sunflower Cooking Oil 2L Twin Pack
  '8901030383178': { productId: 'oil-2l', name: 'Sunflower Cooking Oil Twin Pack' },
  'ST:oil-2l': { productId: 'oil-2l', name: 'Sunflower Cooking Oil Twin Pack' },
};

/**
 * Resolves a scanned or entered barcode string to a canonical catalog productId.
 */
export function resolveBarcodeToProductId(barcode: string): string | null {
  if (!barcode) return null;
  const clean = barcode.trim();
  const entry = BARCODE_CATALOG[clean];
  if (entry) return entry.productId;
  if (clean.startsWith('ST:')) return clean.substring(3);
  return null;
}

/**
 * Resolves the appropriate barcode identifier to send to the backend.
 * If an EAN-13 barcode maps to a canonical product, sends its registered 'ST:<productId>' format.
 */
export function resolveBarcodeToSend(barcode: string): string {
  if (!barcode) return '';
  const clean = barcode.trim();
  const entry = BARCODE_CATALOG[clean];
  if (entry) {
    return `ST:${entry.productId}`;
  }
  return clean;
}
