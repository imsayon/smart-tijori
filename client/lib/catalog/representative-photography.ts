import type { ProductOffer } from '@/contracts';

/**
 * Real, openly licensed photographs of generic grocery products.
 * Not assertions about actual merchant packaging, brands, or stock.
 * See docs/PRODUCT_PHOTOGRAPHY.md for each file's Wikimedia source/license.
 */
const productPhoto: Readonly<Record<string, string>> = {
  // Produce and dairy
  'demo-tomato-500g': 'Vegetable_tomatoes.jpg',
  'demo-onion-1kg': 'Red_onion.jpg',
  'demo-potato-1kg': 'Potato1.jpg',
  'demo-lemon-6ct': 'Whole-Lemon.jpg',
  'demo-banana-12ct': 'Gfp-bananas.jpg',
  'demo-apple-1kg': 'Apple15112024.jpg',
  'demo-coconut-1ct': 'Coconut.png',
  'demo-spinach-250g': 'Spinach_bunches_in_a_stack.jpg',
  'demo-milk-500ml': 'Milk_2.jpg',
  'demo-eggs-6ct': 'GroceryStoreEggs.JPG',
  'demo-bread-400g': 'Bread_1.jpg',
  'demo-ginger-250g': 'Ginger_roots_in_a_bin.jpg',
  // Pantry, spices and regional produce
  'demo-turmeric-100g': 'Turmeric_Powder.jpg',
  'demo-cumin-100g': 'Whole_Cumin_Seeds.jpg',
  'demo-cardamom-50g': 'Green_Cardamom_Pods.jpg',
  'demo-tea-250g': 'Steaming_tea_leaves.jpg',
  'demo-dry-fruit-250g': 'Raisins_02.jpg',
  'demo-almonds-250g': 'KASHMIRI_MAMRA_ALMONDS.jpg',
  'demo-sona-masoori-1kg': 'Rice_Grains_1.jpg',
  'demo-assam-joha-500g': 'Rice_Grains_1.jpg',
  // Seafood
  'demo-rohu-500g': 'Rohu_(Lebeo_rohita)_fish_demo.jpg',
  'demo-prawns-500g': 'White_prawn_(Litopenaeus_vannamei).jpg',
  // Original launch-demo catalogue
  'rice-1kg': 'Rice_Grains_1.jpg',
  'rice-5kg': 'Rice_Grains_1.jpg',
  'tea-250': 'Steaming_tea_leaves.jpg',
  'tea-500': 'Steaming_tea_leaves.jpg',
  'tea-green-25': 'Steaming_tea_leaves.jpg',
  'coffee-100': 'Coffee-Beans.jpg',
  'coffee-200': 'Coffee-Beans.jpg',
  'oats-500': 'The_Grains.jpg',
  'oats-1kg': 'The_Grains.jpg',
};

/** For additional similar real products not explicitly in the demo list. */
const purposePhoto: Readonly<Record<string, string>> = {
  'everyday-rice': 'Rice_Grains_1.jpg',
  'aromatic-rice': 'Rice_Grains_1.jpg',
  'black-tea': 'Steaming_tea_leaves.jpg',
  'green-tea': 'Steaming_tea_leaves.jpg',
  'filter-coffee': 'Coffee-Beans.jpg',
  'rolled-oats': 'The_Grains.jpg',
  'fresh-fish': 'Rohu_(Lebeo_rohita)_fish_demo.jpg',
  'fresh-seafood': 'White_prawn_(Litopenaeus_vannamei).jpg',
};

const namePhoto = [
  [/\btomatoes?\b/i, 'Vegetable_tomatoes.jpg'],
  [/\bonions?\b/i, 'Red_onion.jpg'],
  [/\bpotatoes?\b/i, 'Potato1.jpg'],
  [/\blemons?\b/i, 'Whole-Lemon.jpg'],
  [/\bbananas?\b/i, 'Gfp-bananas.jpg'],
  [/\bapples?\b/i, 'Apple15112024.jpg'],
  [/\bcoconut\b/i, 'Coconut.png'],
  [/\bspinach\b/i, 'Spinach_bunches_in_a_stack.jpg'],
  [/\beggs?\b/i, 'GroceryStoreEggs.JPG'],
  [/\bbread\b/i, 'Bread_1.jpg'],
  [/\bginger\b/i, 'Ginger_roots_in_a_bin.jpg'],
  [/\bturmeric\b/i, 'Turmeric_Powder.jpg'],
  [/\bcumin\b/i, 'Whole_Cumin_Seeds.jpg'],
  [/\bcardamom\b/i, 'Green_Cardamom_Pods.jpg'],
  [/\braisins?\b/i, 'Raisins_02.jpg'],
  [/\balmonds?\b/i, 'KASHMIRI_MAMRA_ALMONDS.jpg'],
  [/\bcoffee\b/i, 'Coffee-Beans.jpg'],
  [/\boats?\b/i, 'The_Grains.jpg'],
  [/\brohu\b/i, 'Rohu_(Lebeo_rohita)_fish_demo.jpg'],
  [/\bprawns?\b/i, 'White_prawn_(Litopenaeus_vannamei).jpg'],
] as const;

export type PhotoSelection = { url: string; representative: boolean; sourceFile?: string };

export function chooseProductPhoto(offer: Pick<ProductOffer, 'productId' | 'purpose' | 'name' | 'imageUrl'>): PhotoSelection | null {
  const exact = offer.imageUrl?.trim();
  if (exact && (/^https:\/\//i.test(exact) || /^\/(?![\/\\])/.test(exact))) {
    return { url: exact, representative: false };
  }
  const filename = productPhoto[offer.productId]
    ?? namePhoto.find(([pattern]) => pattern.test(offer.name))?.[1]
    ?? purposePhoto[offer.purpose];
  if (!filename) return null;
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=640`;
  return { url, representative: true, sourceFile: filename };
}
