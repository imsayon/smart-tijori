import { searchProducts } from "../server/discovery/search-service";

async function runDemos() {
  console.log("=== SmartTijori Discovery Search Verification ===");
  console.log("Connecting to live Aiven OpenSearch index...");
  console.log("Facts reader: FixtureProductFactsReader (Controlled Development Data)\n");

  // 1. Typo search: "Surf Exel" (intentional misspelling of Surf Excel)
  console.log("1. Typo-tolerant Query: 'Surf Exel' (store: mys-01)");
  const typoRes = await searchProducts({ q: "Surf Exel", storeId: "mys-01", limit: 3 });
  console.log(`Matched ${typoRes.items.length} items:`);
  for (const item of typoRes.items) {
    console.log(` - [${item.productId}] ${item.name} | ₹${item.pricePaise / 100} | store: ${item.storeId} | available: ${item.available}`);
  }

  // 2. Query for product: "Ghee" (actual fixture product)
  console.log("\n2. Product Keyword Query: 'Ghee' (store: blr-01)");
  const gheeRes = await searchProducts({ q: "Ghee", storeId: "blr-01", limit: 3 });
  console.log(`Matched ${gheeRes.items.length} items:`);
  for (const item of gheeRes.items) {
    console.log(` - [${item.productId}] ${item.name} | ₹${item.pricePaise / 100} | store: ${item.storeId} | available: ${item.available}`);
  }

  // 3. Category-filtered Query: "Cooking Oils & Ghee"
  console.log("\n3. Category Filtered Query: category='Cooking Oils & Ghee' (store: blr-01)");
  const catRes = await searchProducts({ category: "Cooking Oils & Ghee", storeId: "blr-01", limit: 4 });
  console.log(`Matched ${catRes.items.length} items:`);
  for (const item of catRes.items) {
    console.log(` - [${item.productId}] ${item.name} | category: ${item.category} | ₹${item.pricePaise / 100}`);
  }

  // 4. Price-filtered Query: minPricePaise=20000 (₹200) & maxPricePaise=30000 (₹300)
  console.log("\n4. Price Range Filter: ₹200 to ₹300 (20000 to 30000 paise, store: mys-01)");
  const priceRes = await searchProducts({ minPricePaise: 20000, maxPricePaise: 30000, storeId: "mys-01", limit: 4 });
  console.log(`Matched ${priceRes.items.length} items:`);
  for (const item of priceRes.items) {
    console.log(` - [${item.productId}] ${item.name} | ₹${item.pricePaise / 100}`);
  }

  // 5. Store-specific Query: storeId='blr-01' vs storeId='mys-01'
  console.log("\n5. Store-Specific Query: 'Tea' in blr-01 vs mys-01");
  const blrTea = await searchProducts({ q: "Tea", storeId: "blr-01", limit: 2 });
  console.log(`Store blr-01 matches:`);
  for (const item of blrTea.items) {
    console.log(` - [${item.productId}] ${item.name} | store: ${item.storeId} | city: ${item.city}`);
  }
  const mysTea = await searchProducts({ q: "Tea", storeId: "mys-01", limit: 2 });
  console.log(`Store mys-01 matches:`);
  for (const item of mysTea.items) {
    console.log(` - [${item.productId}] ${item.name} | store: ${item.storeId} | city: ${item.city}`);
  }

  console.log("\n=== Verification Completed Successfully ===");
}

runDemos().catch(console.error);

