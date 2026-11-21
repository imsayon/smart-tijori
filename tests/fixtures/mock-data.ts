import type { Store, ProductOffer, Cart, Hold } from '@/contracts';

export const MOCK_STORES: Store[] = [
  { id: 'blr-01', name: 'SmartTijori Bengaluru', city: 'Bengaluru' },
  { id: 'mys-01', name: 'SmartTijori Mysuru', city: 'Mysuru' },
];

export const MOCK_OFFER: ProductOffer = {
  productId: 'blr-detergent-liquid-1l',
  storeId: 'blr-01',
  city: 'Bengaluru',
  name: 'Liquid Detergent (Machine)',
  category: 'household',
  purpose: 'laundry-detergent',
  pricePaise: 22900,
  imageUrl: '/images/blr-detergent-liquid-1l.webp',
  pack: { quantity: 1000, unit: 'ml' },
  attributes: { machineWash: 'yes', type: 'front-load' },
  available: 10,
  inventoryVersion: 1,
  checkedAt: new Date().toISOString(),
};

export const MOCK_CART: Cart = {
  id: 'cart-test-01',
  sessionId: '11111111-1111-4111-8111-111111111111',
  storeId: 'blr-01',
  lines: [
    {
      productId: 'blr-detergent-liquid-1l',
      quantity: 1,
      name: 'Liquid Detergent (Machine)',
      unitPricePaise: 22900,
    },
  ],
  totalPaise: 22900,
};

export const MOCK_HOLD: Hold = {
  id: 'hold-test-01',
  cartId: 'cart-test-01',
  sessionId: '11111111-1111-4111-8111-111111111111',
  storeId: 'blr-01',
  status: 'ACTIVE',
  expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
  serverNow: new Date().toISOString(),
  lines: [
    {
      productId: 'blr-detergent-liquid-1l',
      quantity: 1,
      name: 'Liquid Detergent (Machine)',
      unitPricePaise: 22900,
    },
  ],
  totalPaise: 22900,
};
