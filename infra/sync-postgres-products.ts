import {
  getOpenSearchClient,
  getOpenSearchConfig,
  checkOpenSearchHealth,
} from "../server/discovery/opensearch-client";
import { syncPostgresProductsToOpenSearch } from "../server/discovery/postgres-index-syncer";

async function main() {
  console.log("=== SmartTijori: Sync PostgreSQL Products to OpenSearch ===");

  try {
    const config = getOpenSearchConfig();
    const client = getOpenSearchClient();

    console.log(`OpenSearch URL Host: ${new URL(config.url).host}`);
    console.log(`Target Index: ${config.index}`);

    console.log("Checking OpenSearch cluster health...");
    const health = await checkOpenSearchHealth(client);
    console.log(`Cluster: ${health.clusterName} (status: ${health.status})`);

    if (!health.healthy) {
      throw new Error(`OpenSearch cluster is not healthy: ${health.status}`);
    }

    console.log("Fetching and indexing products from PostgreSQL view st_platform_verify_v1.demo_search_documents...");
    const startTime = Date.now();

    const result = await syncPostgresProductsToOpenSearch({
      client,
      index: config.index,
      batchSize: 250,
      refresh: true,
      onProgress: ({ processed, total, applied, unchanged, failed }) => {
        const pct = Math.round((processed / total) * 100);
        console.log(
          `Progress: ${processed}/${total} (${pct}%) | Applied: ${applied} | Unchanged: ${unchanged} | Failed: ${failed}`
        );
      },
    });

    const elapsedMs = Date.now() - startTime;
    console.log("\n=== Sync Summary ===");
    console.log(`Total records fetched: ${result.totalFetched}`);
    console.log(`Applied (new/updated): ${result.appliedCount}`);
    console.log(`Unchanged (version guard): ${result.unchangedCount}`);
    console.log(`Failures: ${result.failureCount}`);
    console.log(`Batches processed: ${result.batches}`);
    console.log(`Time elapsed: ${elapsedMs}ms`);

    if (result.failureCount > 0) {
      console.error("\nErrors encountered during sync:");
      for (const err of result.errors.slice(0, 10)) {
        console.error(`- ${err}`);
      }
      if (result.errors.length > 10) {
        console.error(`... and ${result.errors.length - 10} more`);
      }
      process.exit(1);
    }

    console.log("\n=== PostgreSQL-to-OpenSearch Sync Completed Successfully ===");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Sync failed:", msg);
    process.exit(1);
  }
}

main();

