/**
 * Standard barcode mapping dictionary for participating POS barcode scanning.
 * Maps EAN-13, UPC, and shelf barcodes to catalog product IDs.
 *
 * NOTE: Standard barcode identifies a SKU/ProductOffer, not a serialized individual physical unit.
 * The gate protects participating, connected POS systems.
 */

export interface BarcodeMapping {
  barcode: string;
  productId: string;
  format: 'EAN-13' | 'UPC-A' | 'SHELF-SKU';
}

export const BARCODE_CATALOG: Record<string, string> = {
  // Basmati Rice 1kg
  '8901030383123': 'blr-basmati-1kg',
  'SKU-BASMATI-1KG': 'blr-basmati-1kg',
  // Sona Masoori 5kg
  '8901030383130': 'blr-sona-masoori-5kg',
  'SKU-SONA-5KG': 'blr-sona-masoori-5kg',
  // Toor Dal 1kg
  '8901030383147': 'blr-toor-dal-1kg',
  'SKU-TOOR-1KG': 'blr-toor-dal-1kg',
  // Moong Dal 500g
  '8901030383154': 'blr-moong-dal-500g',
  'SKU-MOONG-500G': 'blr-moong-dal-500g',
  // Sunflower Oil 1L
  '8901030383161': 'blr-sunflower-oil-1l',
  'SKU-OIL-1L': 'blr-sunflower-oil-1l',
  // Groundnut Oil 1L
  '8901030383178': 'blr-groundnut-oil-1l',
  'SKU-GNDNUT-1L': 'blr-groundnut-oil-1l',
  // Filter Coffee 200g
  '8901030383185': 'blr-filter-coffee-200g',
  'SKU-COFFEE-200G': 'blr-filter-coffee-200g',
  // Tea Powder 250g
  '8901030383192': 'blr-tea-powder-250g',
  'SKU-TEA-250G': 'blr-tea-powder-250g',
  // Dishwash Liquid 500ml
  '8901030383208': 'blr-dishwash-liquid-500ml',
  'SKU-DISHWASH-500ML': 'blr-dishwash-liquid-500ml',
  // Detergent Liquid 1L
  '8901030383215': 'blr-detergent-liquid-1l',
  'SKU-DETERGENT-1L': 'blr-detergent-liquid-1l',
};

/**
 * Resolves a scanned or entered barcode string to a catalog productId.
 * Trims whitespace and strips non-printable control characters.
 */
export function resolveBarcodeToProductId(barcode: string): string | null {
  if (!barcode) return null;
  const cleanBarcode = barcode.trim();
  return BARCODE_CATALOG[cleanBarcode] ?? null;
}
