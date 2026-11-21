import { getOpenSearchClient, getOpenSearchConfig } from "../server/discovery/opensearch-client";
import { setupProductIndex } from "../server/discovery/index-definition";
import { writeProjection } from "../server/discovery/projection-writer";
import { buildFixtureOffers } from "../server/discovery/fixtures/catalog-fixture";

async function main() {
  console.log("=== Seeding SmartTijori Catalog Fixtures into OpenSearch ===");
  try {
    const config = getOpenSearchConfig();
    const client = getOpenSearchClient();

    console.log(`Target Index: ${config.index}`);
    console.log(`Setting up index mapping if not already created...`);
    const setupResult = await setupProductIndex(client);
    console.log(`Index status: ${setupResult.alreadyExisted ? "already existed" : "created"}`);

    const offers = buildFixtureOffers();
    console.log(`Writing ${offers.length} offers (24 catalog products across 2 stores)...`);

    const result = await writeProjection(offers, {
      index: config.index,
      refresh: true,
    });

    console.log(`Write projection complete:`);
    console.log(`- Applied: ${result.appliedCount}`);
    console.log(`- Unchanged: ${result.unchangedCount}`);
    console.log(`- Failures: ${result.failureCount}`);

    if (result.failureCount > 0) {
      console.error("Some items failed to index:", result.items.filter((i) => i.status === "failure"));
      process.exit(1);
    }

    console.log("=== Seeding Completed Successfully ===");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Seeding failed:", msg);
    process.exit(1);
  }
}

main();
