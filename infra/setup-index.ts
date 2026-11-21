import { getOpenSearchClient, getOpenSearchConfig, checkOpenSearchHealth } from "../server/discovery/opensearch-client";
import { setupProductIndex } from "../server/discovery/index-definition";

async function main() {
  console.log("=== SmartTijori OpenSearch Setup ===");
  try {
    const config = getOpenSearchConfig();
    console.log(`Target Index: ${config.index}`);
    console.log(`OpenSearch URL host: ${new URL(config.url).host}`);

    const client = getOpenSearchClient();
    console.log("Checking cluster health...");
    const health = await checkOpenSearchHealth(client);

    console.log(`Connected successfully!`);
    console.log(`Cluster: ${health.clusterName}`);
    console.log(`Cluster Status: ${health.status}`);
    console.log(`OpenSearch Version: ${health.version}`);
    console.log(`Target index exists: ${health.indexExists}`);

    console.log(`Ensuring index '${config.index}' is set up...`);
    const setupResult = await setupProductIndex(client);

    if (setupResult.created) {
      console.log(`Successfully created index: ${setupResult.index}`);
    } else {
      console.log(`Index already exists and is ready: ${setupResult.index}`);
    }

    console.log("=== OpenSearch Setup Complete ===");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("OpenSearch setup failed:", msg);
    process.exit(1);
  }
}

main();
