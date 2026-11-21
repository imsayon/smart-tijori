export interface Store {
  id: string;
  name: string;
  city: "Bengaluru" | "Mysuru" | string;
}

export interface Pack {
  quantity: number;
  unit: "g" | "kg" | "ml" | "l" | "count" | string;
}

export interface ProductOffer {
  productId: string;
  storeId: string;
  city: string;
  name: string;
  category: string;
  purpose: string;
  description?: string;
  pricePaise: number;
  imageUrl: string;
  pack: Pack;
  knownAttributes: Record<string, string | number | boolean | string[]>;
  available: boolean;
  availableStock?: number;
  inventoryVersion: number;
  checkedAt: string; // ISO 8601
}
