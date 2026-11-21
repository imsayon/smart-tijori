import type { ProductOffer, Store } from "../../contracts/catalog";
import type { ProductFactsReader } from "../../contracts/facts";

/**
 * DEVELOPMENT FIXTURE CATALOG
 * 
 * Explicitly labeled as controlled test/development data.
 * Does not represent live inventory or database records.
 * Contains 24 curated pantry and household packaged goods across Bengaluru and Mysuru.
 */
export const IS_DEVELOPMENT_FIXTURE = true;

export const FIXTURE_STORES: Store[] = [
  { id: "blr-01", name: "SmartTijori Indiranagar", city: "Bengaluru" },
  { id: "mys-01", name: "SmartTijori Saraswathipuram", city: "Mysuru" },
];

export interface BaseCatalogItem {
  productId: string;
  name: string;
  category: "Laundry & Detergents" | "Tea & Beverages" | "Cooking Oils & Ghee" | "Staples & Pulses" | "Household Cleaning";
  purpose: string;
  description: string;
  pricePaise: number;
  imageUrl: string;
  pack: { quantity: number; unit: "g" | "kg" | "ml" | "l" | "count" };
  knownAttributes: Record<string, string | number | boolean | string[]>;
}

export const BASE_24_CATALOG_ITEMS: BaseCatalogItem[] = [
  // 1. Laundry & Detergents (Substitute group for signature scenario)
  {
    productId: "det-surf-matic-front-1l",
    name: "Surf Excel Matic Front Load Liquid Detergent",
    category: "Laundry & Detergents",
    purpose: "front-load-detergent",
    description: "Designed for front load washing machines with superior stain removal in 1 wash.",
    pricePaise: 28000,
    imageUrl: "/images/products/surf-excel-matic-front-1l.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {
      machineType: "front-load",
      form: "liquid",
      fragrance: "fresh",
      safeForColors: true,
    },
  },
  {
    productId: "det-ariel-matic-front-1l",
    name: "Ariel Matic Front Load Liquid Detergent",
    category: "Laundry & Detergents",
    purpose: "front-load-detergent",
    description: "Tough stain removal formula specially engineered for fully automatic front load washers.",
    pricePaise: 26500,
    imageUrl: "/images/products/ariel-matic-front-1l.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {
      machineType: "front-load",
      form: "liquid",
      fragrance: "citrus",
      safeForColors: true,
    },
  },
  {
    productId: "det-henko-matic-front-1kg",
    name: "Henko Matic Front Load Detergent Powder",
    category: "Laundry & Detergents",
    purpose: "front-load-detergent",
    description: "Lint reduction and color protection technology for front load washing machines.",
    pricePaise: 24000,
    imageUrl: "/images/products/henko-matic-front-1kg.webp",
    pack: { quantity: 1000, unit: "g" },
    knownAttributes: {
      machineType: "front-load",
      form: "powder",
      fragrance: "floral",
      safeForColors: true,
    },
  },
  {
    productId: "det-tide-matic-top-1l",
    name: "Tide Matic Top Load Liquid Detergent",
    category: "Laundry & Detergents",
    purpose: "top-load-detergent",
    description: "High foaming formula tailored for top loading washing machines.",
    pricePaise: 21000,
    imageUrl: "/images/products/tide-matic-top-1l.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {
      machineType: "top-load",
      form: "liquid",
      fragrance: "jasmine",
      safeForColors: true,
    },
  },
  {
    productId: "det-wipro-safewash-1l",
    name: "Wipro Safewash Liquid Detergent",
    category: "Laundry & Detergents",
    purpose: "delicate-wash-detergent",
    description: "Gentle 7-in-1 fabric care for woollens, silks, and delicate garments.",
    pricePaise: 23000,
    imageUrl: "/images/products/wipro-safewash-1l.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {
      machineType: "all",
      form: "liquid",
      fragrance: "gentle",
      safeForColors: true,
    },
  },

  // 2. Tea & Beverages
  {
    productId: "bev-red-label-tea-500g",
    name: "Brooke Bond Red Label Strong Leaf Tea",
    category: "Tea & Beverages",
    purpose: "black-tea",
    description: "Expertly selected Assam and Dooars tea leaves for rich taste and distinct aroma.",
    pricePaise: 29000,
    imageUrl: "/images/products/red-label-tea-500g.webp",
    pack: { quantity: 500, unit: "g" },
    knownAttributes: {
      caffeine: true,
      blend: "assam-leaf",
      packaging: "pouch",
    },
  },
  {
    productId: "bev-tata-tea-premium-500g",
    name: "Tata Tea Premium Desh Ki Chai",
    category: "Tea & Beverages",
    purpose: "black-tea",
    description: "Unique blend of big tea leaves for aroma and small grains for strength.",
    pricePaise: 27500,
    imageUrl: "/images/products/tata-tea-premium-500g.webp",
    pack: { quantity: 500, unit: "g" },
    knownAttributes: {
      caffeine: true,
      blend: "leaf-and-dust",
      packaging: "pouch",
    },
  },
  {
    productId: "bev-nescafe-classic-100g",
    name: "Nescafe Classic 100% Pure Instant Coffee",
    category: "Tea & Beverages",
    purpose: "instant-coffee",
    description: "Medium-dark roasted Robusta coffee beans delivering full, bold aroma.",
    pricePaise: 34000,
    imageUrl: "/images/products/nescafe-classic-100g.webp",
    pack: { quantity: 100, unit: "g" },
    knownAttributes: {
      caffeine: true,
      roast: "medium-dark",
      packaging: "glass-jar",
    },
  },
  {
    productId: "bev-bru-instant-100g",
    name: "Bru Instant Coffee Chicory Blend",
    category: "Tea & Beverages",
    purpose: "instant-coffee",
    description: "Finest blend of 70% selected plantation coffee beans and 30% chicory.",
    pricePaise: 25000,
    imageUrl: "/images/products/bru-instant-100g.webp",
    pack: { quantity: 100, unit: "g" },
    knownAttributes: {
      caffeine: true,
      blend: "coffee-chicory",
      packaging: "pouch",
    },
  },

  // 3. Cooking Oils & Ghee
  {
    productId: "oil-fortune-sunflower-1l",
    name: "Fortune Sunlite Refined Sunflower Oil",
    category: "Cooking Oils & Ghee",
    purpose: "cooking-oil",
    description: "Light and healthy refined sunflower oil enriched with Vitamins A and D.",
    pricePaise: 15500,
    imageUrl: "/images/products/fortune-sunflower-1l.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {
      source: "sunflower",
      refined: true,
      dietary: "vegetarian",
    },
  },
  {
    productId: "oil-saffola-gold-1l",
    name: "Saffola Gold Blended Edible Oil",
    category: "Cooking Oils & Ghee",
    purpose: "cooking-oil",
    description: "Dual seed technology blending Rice Bran Oil and Sunflower Oil for heart health.",
    pricePaise: 19500,
    imageUrl: "/images/products/saffola-gold-1l.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {
      source: "rice-bran-sunflower",
      refined: true,
      dietary: "vegetarian",
    },
  },
  {
    productId: "oil-dhara-mustard-1l",
    name: "Dhara Kachi Ghani Pure Mustard Oil",
    category: "Cooking Oils & Ghee",
    purpose: "cooking-oil",
    description: "Traditionally pressed mustard oil with natural pungency and strong aroma.",
    pricePaise: 17000,
    imageUrl: "/images/products/dhara-mustard-1l.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {
      source: "mustard",
      refined: false,
      coldPressed: true,
      dietary: "vegetarian",
    },
  },
  {
    productId: "oil-nandini-pure-ghee-500ml",
    name: "Nandini Pure Cow Ghee Jar",
    category: "Cooking Oils & Ghee",
    purpose: "pure-ghee",
    description: "Authentic Karnataka milk federation pure cow ghee with granular texture and rich aroma.",
    pricePaise: 32000,
    imageUrl: "/images/products/nandini-pure-ghee-500ml.webp",
    pack: { quantity: 500, unit: "ml" },
    knownAttributes: {
      source: "cow-milk",
      traditional: true,
      dietary: "vegetarian",
    },
  },

  // 4. Staples & Pulses
  {
    productId: "stp-aashirvaad-atta-5kg",
    name: "Aashirvaad Superior MP Sharbati Atta",
    category: "Staples & Pulses",
    purpose: "whole-wheat-flour",
    description: "100% pure whole wheat grain flour ensuring fluffy, soft rotis for hours.",
    pricePaise: 26000,
    imageUrl: "/images/products/aashirvaad-atta-5kg.webp",
    pack: { quantity: 5000, unit: "g" },
    knownAttributes: {
      grain: "wheat",
      maidaFree: true,
      organic: false,
    },
  },
  {
    productId: "stp-fortune-chakki-atta-5kg",
    name: "Fortune Chakki Fresh Pure Whole Wheat Atta",
    category: "Staples & Pulses",
    purpose: "whole-wheat-flour",
    description: "Traditional stone chakki ground whole wheat flour with natural dietary fiber.",
    pricePaise: 23000,
    imageUrl: "/images/products/fortune-chakki-atta-5kg.webp",
    pack: { quantity: 5000, unit: "g" },
    knownAttributes: {
      grain: "wheat",
      maidaFree: true,
      organic: false,
    },
  },
  {
    productId: "stp-india-gate-basmati-1kg",
    name: "India Gate Feast Rozzana Basmati Rice",
    category: "Staples & Pulses",
    purpose: "basmati-rice",
    description: "Medium slender basmati grains aged to perfection for everyday meals.",
    pricePaise: 11500,
    imageUrl: "/images/products/india-gate-basmati-1kg.webp",
    pack: { quantity: 1000, unit: "g" },
    knownAttributes: {
      grain: "basmati",
      aged: true,
      grainLength: "medium",
    },
  },
  {
    productId: "stp-daawat-biryani-rice-1kg",
    name: "Daawat Super Biryani Basmati Rice",
    category: "Staples & Pulses",
    purpose: "basmati-rice",
    description: "Extra long slender grains that elongate up to 24mm when cooked, ideal for royal biryani.",
    pricePaise: 14500,
    imageUrl: "/images/products/daawat-biryani-rice-1kg.webp",
    pack: { quantity: 1000, unit: "g" },
    knownAttributes: {
      grain: "basmati",
      aged: true,
      grainLength: "extra-long",
    },
  },
  {
    productId: "stp-tata-sampann-toor-1kg",
    name: "Tata Sampann Unpolished Toor Dal",
    category: "Staples & Pulses",
    purpose: "toor-dal",
    description: "Naturally protein rich unpolished arhar dal with no artificial polish or coloring.",
    pricePaise: 17500,
    imageUrl: "/images/products/tata-sampann-toor-1kg.webp",
    pack: { quantity: 1000, unit: "g" },
    knownAttributes: {
      pulse: "toor",
      unpolished: true,
      proteinGramsPer100g: 22,
    },
  },
  {
    productId: "stp-bb-royal-moong-1kg",
    name: "BB Royal Split Yellow Moong Dal",
    category: "Staples & Pulses",
    purpose: "moong-dal",
    description: "Easy to digest split yellow lentils, cleaned and sorted for quick cooking.",
    pricePaise: 14000,
    imageUrl: "/images/products/bb-royal-moong-1kg.webp",
    pack: { quantity: 1000, unit: "g" },
    knownAttributes: {
      pulse: "moong",
      unpolished: false,
      easyDigest: true,
    },
  },

  // 5. Household Cleaning
  {
    productId: "hsh-vim-dishwash-gel-750ml",
    name: "Vim Lemon Dishwash Gel Squeeze Bottle",
    category: "Household Cleaning",
    purpose: "dishwash-gel",
    description: "Concentrated lime gel that degreases tough burnt stains with just one spoonful.",
    pricePaise: 15000,
    imageUrl: "/images/products/vim-dishwash-gel-750ml.webp",
    pack: { quantity: 750, unit: "ml" },
    knownAttributes: {
      fragrance: "lemon",
      antiBacterial: false,
      skinFriendly: true,
    },
  },
  {
    productId: "hsh-pril-kraft-gel-750ml",
    name: "Pril Lime Kraft Action Dishwash Gel",
    category: "Household Cleaning",
    purpose: "dishwash-gel",
    description: "Active power molecule formula removes deep grease quickly without scratching cookware.",
    pricePaise: 16000,
    imageUrl: "/images/products/pril-kraft-gel-750ml.webp",
    pack: { quantity: 750, unit: "ml" },
    knownAttributes: {
      fragrance: "lime",
      antiBacterial: true,
      skinFriendly: true,
    },
  },
  {
    productId: "hsh-lysol-cleaner-citrus-1l",
    name: "Lysol All-in-One Disinfectant Surface Cleaner",
    category: "Household Cleaning",
    purpose: "floor-cleaner",
    description: "Kills 99.9% of germs and viruses while removing greasy soil from tiled floors.",
    pricePaise: 21000,
    imageUrl: "/images/products/lysol-cleaner-citrus-1l.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {
      fragrance: "citrus",
      disinfectant: true,
      safeOnSurfaces: ["marble", "granite", "tiles"],
    },
  },
  {
    productId: "hsh-colin-glass-cleaner-500ml",
    name: "Colin Glass and Surface Cleaner Spray",
    category: "Household Cleaning",
    purpose: "glass-cleaner",
    description: "Streak-free shine formula for glass tables, mirrors, and shiny appliances.",
    pricePaise: 11000,
    imageUrl: "/images/products/colin-glass-cleaner-500ml.webp",
    pack: { quantity: 500, unit: "ml" },
    knownAttributes: {
      streakFree: true,
      sprayBottle: true,
    },
  },
  {
    productId: "hsh-dettol-handwash-750ml",
    name: "Dettol Original Germ Protection Handwash Refill",
    category: "Household Cleaning",
    purpose: "handwash",
    description: "Trusted 100% germ protection liquid handwash enriched with moisturizers.",
    pricePaise: 13000,
    imageUrl: "/images/products/dettol-handwash-750ml.webp",
    pack: { quantity: 750, unit: "ml" },
    knownAttributes: {
      fragrance: "pine",
      antiBacterial: true,
      refillPouch: true,
    },
  },
];

/**
 * Builds the complete multi-branch fixtures (24 items * 2 stores = 48 offers)
 */
export function buildFixtureOffers(): ProductOffer[] {
  const offers: ProductOffer[] = [];
  const checkedAt = new Date().toISOString();

  for (const store of FIXTURE_STORES) {
    for (const item of BASE_24_CATALOG_ITEMS) {
      // In blr-01, simulate Surf Excel as the signature "last-unit" or low-stock candidate
      // Henko and Ariel are fully available. In mys-01, all are available.
      const isSignatureTest = store.id === "blr-01" && item.productId === "det-surf-matic-front-1l";

      offers.push({
        productId: item.productId,
        storeId: store.id,
        city: store.city,
        name: item.name,
        category: item.category,
        purpose: item.purpose,
        description: item.description,
        pricePaise: item.pricePaise,
        imageUrl: item.imageUrl,
        pack: item.pack,
        knownAttributes: item.knownAttributes,
        available: isSignatureTest ? false : true,
        inventoryVersion: 1,
        checkedAt,
      });
    }
  }

  return offers;
}

/**
 * Standalone in-memory facts reader implementing ProductFactsReader
 */
export class FixtureProductFactsReader implements ProductFactsReader {
  private offersMap: Map<string, ProductOffer>;

  constructor(customOffers?: ProductOffer[]) {
    const list = customOffers ?? buildFixtureOffers();
    this.offersMap = new Map();
    for (const offer of list) {
      this.offersMap.set(`${offer.storeId}:${offer.productId}`, offer);
    }
  }

  async readProductFacts(storeId: string, productIds: string[]): Promise<ProductOffer[]> {
    const results: ProductOffer[] = [];
    for (const productId of productIds) {
      const match = this.offersMap.get(`${storeId}:${productId}`);
      if (match) {
        results.push({ ...match });
      }
    }
    return results;
  }
}
