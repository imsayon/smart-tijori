import type { Store, ProductOffer } from '@/contracts';

// =============================================================================
// Store Fixtures — Multiple neighborhood stores across Bengaluru & Mysuru
// =============================================================================

export const STORES: Store[] = [
  // Bengaluru Area Stores
  {
    id: 'blr-01',
    name: 'SmartTijori Koramangala',
    city: 'Bengaluru',
    area: 'Koramangala',
    address: '80 Feet Road, 4th Block, Koramangala',
  },
  {
    id: 'blr-02',
    name: 'SmartTijori Indiranagar',
    city: 'Bengaluru',
    area: 'Indiranagar',
    address: '100 Feet Road, HAL 2nd Stage, Indiranagar',
  },
  {
    id: 'blr-03',
    name: 'SmartTijori Jayanagar',
    city: 'Bengaluru',
    area: 'Jayanagar',
    address: '11th Main Road, 4th Block, Jayanagar',
  },
  {
    id: 'blr-04',
    name: 'SmartTijori Whitefield',
    city: 'Bengaluru',
    area: 'Whitefield',
    address: 'Main Road, near ITPL, Whitefield',
  },
  // Mysuru Area Stores
  {
    id: 'mys-01',
    name: 'SmartTijori Saraswathipuram',
    city: 'Mysuru',
    area: 'Saraswathipuram',
    address: '5th Main Road, Saraswathipuram, Mysuru',
  },
  {
    id: 'mys-02',
    name: 'SmartTijori Gokulam',
    city: 'Mysuru',
    area: 'Gokulam',
    address: '3rd Stage, Gokulam, Mysuru',
  },
];

// =============================================================================
// Helper
// =============================================================================

const NOW = '2026-01-15T10:00:00.000Z';
let versionCounter = 1;

function offer(
  overrides: Partial<ProductOffer> &
    Pick<ProductOffer, 'productId' | 'storeId' | 'name' | 'category' | 'purpose' | 'pricePaise' | 'pack'>,
): ProductOffer {
  return {
    city: overrides.storeId === 'blr-01' ? 'Bengaluru' : 'Mysuru',
    imageUrl: `/images/${overrides.productId}.webp`,
    attributes: {},
    available: 50,
    inventoryVersion: versionCounter++,
    checkedAt: NOW,
    ...overrides,
  };
}

// =============================================================================
// Product Fixtures — 24 curated products across both stores
// =============================================================================

export const PRODUCT_OFFERS: ProductOffer[] = [
  // ---------------------------------------------------------------------------
  // PANTRY — Bengaluru (blr-01)
  // ---------------------------------------------------------------------------
  offer({
    productId: 'blr-basmati-1kg',
    storeId: 'blr-01',
    name: 'Premium Basmati Rice',
    category: 'pantry',
    purpose: 'cooking-rice',
    pricePaise: 18500,
    pack: { quantity: 1000, unit: 'g' },
    attributes: { grain: 'long', aged: 'yes' },
  }),
  offer({
    productId: 'blr-basmati-5kg',
    storeId: 'blr-01',
    name: 'Premium Basmati Rice (Family Pack)',
    category: 'pantry',
    purpose: 'cooking-rice',
    pricePaise: 82500,
    pack: { quantity: 5000, unit: 'g' },
    attributes: { grain: 'long', aged: 'yes' },
  }),
  offer({
    productId: 'blr-toor-dal-1kg',
    storeId: 'blr-01',
    name: 'Toor Dal (Arhar)',
    category: 'pantry',
    purpose: 'cooking-dal',
    pricePaise: 16000,
    pack: { quantity: 1000, unit: 'g' },
    attributes: { polished: 'yes' },
  }),
  offer({
    productId: 'blr-sunflower-oil-1l',
    storeId: 'blr-01',
    name: 'Sunflower Oil',
    category: 'pantry',
    purpose: 'cooking-oil',
    pricePaise: 15500,
    pack: { quantity: 1000, unit: 'ml' },
    attributes: { refined: 'yes' },
  }),
  offer({
    productId: 'blr-coconut-oil-500ml',
    storeId: 'blr-01',
    name: 'Cold-Pressed Coconut Oil',
    category: 'pantry',
    purpose: 'cooking-oil',
    pricePaise: 21000,
    pack: { quantity: 500, unit: 'ml' },
    attributes: { refined: 'no', coldPressed: 'yes' },
  }),
  offer({
    productId: 'blr-atta-5kg',
    storeId: 'blr-01',
    name: 'Whole Wheat Atta',
    category: 'pantry',
    purpose: 'cooking-flour',
    pricePaise: 27500,
    pack: { quantity: 5000, unit: 'g' },
    attributes: { type: 'whole-wheat' },
  }),
  offer({
    productId: 'blr-sugar-1kg',
    storeId: 'blr-01',
    name: 'White Sugar',
    category: 'pantry',
    purpose: 'sweetener',
    pricePaise: 4500,
    pack: { quantity: 1000, unit: 'g' },
  }),
  offer({
    productId: 'blr-tea-250g',
    storeId: 'blr-01',
    name: 'Premium CTC Tea',
    category: 'pantry',
    purpose: 'beverage-tea',
    pricePaise: 12000,
    pack: { quantity: 250, unit: 'g' },
    attributes: { type: 'CTC', origin: 'Assam' },
  }),

  // ---------------------------------------------------------------------------
  // HOUSEHOLD — Bengaluru (blr-01)  — substitute groups for detergents
  // ---------------------------------------------------------------------------
  offer({
    productId: 'blr-detergent-powder-1kg',
    storeId: 'blr-01',
    name: 'Detergent Powder (Regular)',
    category: 'household',
    purpose: 'laundry-detergent',
    pricePaise: 9900,
    pack: { quantity: 1000, unit: 'g' },
    attributes: { machineWash: 'no', handWash: 'yes' },
  }),
  offer({
    productId: 'blr-detergent-liquid-1l',
    storeId: 'blr-01',
    name: 'Liquid Detergent (Machine)',
    category: 'household',
    purpose: 'laundry-detergent',
    pricePaise: 22900,
    pack: { quantity: 1000, unit: 'ml' },
    attributes: { machineWash: 'yes', handWash: 'no', type: 'front-load' },
  }),
  offer({
    productId: 'blr-detergent-liquid-500ml',
    storeId: 'blr-01',
    name: 'Liquid Detergent (Machine, Small)',
    category: 'household',
    purpose: 'laundry-detergent',
    pricePaise: 12900,
    pack: { quantity: 500, unit: 'ml' },
    attributes: { machineWash: 'yes', handWash: 'no', type: 'top-load' },
  }),
  offer({
    productId: 'blr-dishwash-liquid-500ml',
    storeId: 'blr-01',
    name: 'Dishwash Liquid Gel',
    category: 'household',
    purpose: 'dishwashing',
    pricePaise: 9900,
    pack: { quantity: 500, unit: 'ml' },
    attributes: { type: 'gel' },
  }),

  // ---------------------------------------------------------------------------
  // ESSENTIALS — Bengaluru (blr-01)
  // ---------------------------------------------------------------------------
  offer({
    productId: 'blr-soap-bar-3pk',
    storeId: 'blr-01',
    name: 'Bathing Soap (3-Pack)',
    category: 'essentials',
    purpose: 'personal-hygiene',
    pricePaise: 13500,
    pack: { quantity: 3, unit: 'count' },
    attributes: { fragrance: 'sandalwood' },
  }),
  offer({
    productId: 'blr-toothpaste-200g',
    storeId: 'blr-01',
    name: 'Herbal Toothpaste',
    category: 'essentials',
    purpose: 'oral-care',
    pricePaise: 11000,
    pack: { quantity: 200, unit: 'g' },
    attributes: { type: 'herbal', fluoride: 'no' },
  }),

  // ---------------------------------------------------------------------------
  // PANTRY — Mysuru (mys-01)
  // ---------------------------------------------------------------------------
  offer({
    productId: 'mys-basmati-1kg',
    storeId: 'mys-01',
    name: 'Premium Basmati Rice',
    category: 'pantry',
    purpose: 'cooking-rice',
    pricePaise: 19000,
    pack: { quantity: 1000, unit: 'g' },
    attributes: { grain: 'long', aged: 'yes' },
  }),
  offer({
    productId: 'mys-sona-masoori-5kg',
    storeId: 'mys-01',
    name: 'Sona Masoori Rice (Family Pack)',
    category: 'pantry',
    purpose: 'cooking-rice',
    pricePaise: 42500,
    pack: { quantity: 5000, unit: 'g' },
    attributes: { grain: 'medium', aged: 'no' },
  }),
  offer({
    productId: 'mys-moong-dal-1kg',
    storeId: 'mys-01',
    name: 'Green Moong Dal',
    category: 'pantry',
    purpose: 'cooking-dal',
    pricePaise: 18000,
    pack: { quantity: 1000, unit: 'g' },
    attributes: { split: 'yes' },
  }),
  offer({
    productId: 'mys-groundnut-oil-1l',
    storeId: 'mys-01',
    name: 'Groundnut Oil (Filtered)',
    category: 'pantry',
    purpose: 'cooking-oil',
    pricePaise: 19500,
    pack: { quantity: 1000, unit: 'ml' },
    attributes: { refined: 'no', filtered: 'yes' },
  }),
  offer({
    productId: 'mys-jaggery-500g',
    storeId: 'mys-01',
    name: 'Organic Jaggery',
    category: 'pantry',
    purpose: 'sweetener',
    pricePaise: 8500,
    pack: { quantity: 500, unit: 'g' },
    attributes: { organic: 'yes' },
  }),

  // ---------------------------------------------------------------------------
  // HOUSEHOLD — Mysuru (mys-01) — substitute groups for detergents
  // ---------------------------------------------------------------------------
  offer({
    productId: 'mys-detergent-powder-500g',
    storeId: 'mys-01',
    name: 'Detergent Powder (Small)',
    category: 'household',
    purpose: 'laundry-detergent',
    pricePaise: 5500,
    pack: { quantity: 500, unit: 'g' },
    attributes: { machineWash: 'no', handWash: 'yes' },
  }),
  offer({
    productId: 'mys-detergent-liquid-1l',
    storeId: 'mys-01',
    name: 'Liquid Detergent (Machine)',
    category: 'household',
    purpose: 'laundry-detergent',
    pricePaise: 23500,
    pack: { quantity: 1000, unit: 'ml' },
    attributes: { machineWash: 'yes', handWash: 'no', type: 'front-load' },
  }),
  offer({
    productId: 'mys-floor-cleaner-1l',
    storeId: 'mys-01',
    name: 'Floor Cleaner (Citrus)',
    category: 'household',
    purpose: 'floor-cleaning',
    pricePaise: 12500,
    pack: { quantity: 1000, unit: 'ml' },
    attributes: { fragrance: 'citrus' },
  }),

  // ---------------------------------------------------------------------------
  // ESSENTIALS — Mysuru (mys-01)
  // ---------------------------------------------------------------------------
  offer({
    productId: 'mys-shampoo-200ml',
    storeId: 'mys-01',
    name: 'Anti-Dandruff Shampoo',
    category: 'essentials',
    purpose: 'hair-care',
    pricePaise: 17500,
    pack: { quantity: 200, unit: 'ml' },
    attributes: { type: 'anti-dandruff' },
  }),
  offer({
    productId: 'mys-handwash-250ml',
    storeId: 'mys-01',
    name: 'Handwash (Neem)',
    category: 'essentials',
    purpose: 'personal-hygiene',
    pricePaise: 6500,
    pack: { quantity: 250, unit: 'ml' },
    attributes: { fragrance: 'neem', antibacterial: 'yes' },
  }),
];

// =============================================================================
// Helpers for filtering fixtures at runtime
// =============================================================================

export function getStoreOffers(storeId: string): ProductOffer[] {
  const direct = PRODUCT_OFFERS.filter((p) => p.storeId === storeId);
  if (direct.length > 0) return direct;

  const targetStore = STORES.find((s) => s.id === storeId);
  const city = targetStore?.city ?? (storeId.startsWith('blr') ? 'Bengaluru' : 'Mysuru');
  const baseStoreId = city === 'Bengaluru' ? 'blr-01' : 'mys-01';

  // Map city products to this neighborhood store branch
  return PRODUCT_OFFERS.filter((p) => p.storeId === baseStoreId).map((p) => ({
    ...p,
    storeId,
    city,
    inventoryVersion: p.inventoryVersion + 10,
    checkedAt: new Date().toISOString(),
  }));
}

export function searchOffers(
  storeId: string,
  params?: {
    q?: string;
    category?: string;
    minPricePaise?: number;
    maxPricePaise?: number;
  },
): ProductOffer[] {
  let results = getStoreOffers(storeId);

  if (params?.category) {
    results = results.filter((p) => p.category === params.category);
  }
  if (params?.minPricePaise !== undefined) {
    results = results.filter((p) => p.pricePaise >= params.minPricePaise!);
  }
  if (params?.maxPricePaise !== undefined) {
    results = results.filter((p) => p.pricePaise <= params.maxPricePaise!);
  }
  if (params?.q) {
    const q = params.q.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.purpose.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }

  return results;
}
