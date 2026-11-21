import fs from "node:fs";
import path from "node:path";
import { Client } from "@opensearch-project/opensearch";

export interface OpenSearchConfig {
  url: string;
  username?: string;
  password?: string;
  index: string;
  caCertPath?: string;
}

let cachedClient: Client | null = null;
let envLoaded = false;

export function loadEnvironment(): void {
  if (envLoaded) return;
  envLoaded = true;

  const proc = process as unknown as { loadEnvFile?: (path: string) => void };
  if (typeof proc.loadEnvFile === "function") {
    const candidates = [
      path.resolve(process.cwd(), "client/.env.local"),
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
      path.resolve(__dirname, "../../client/.env.local"),
      path.resolve(__dirname, "../../.env.local"),
      path.resolve(__dirname, "../../.env"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          proc.loadEnvFile(candidate);
        } catch {
          // ignore errors from duplicate keys or syntax
        }
      }
    }
  }
}

export function getOpenSearchConfig(): OpenSearchConfig {
  loadEnvironment();

  const url = process.env.OPENSEARCH_URL || process.env.OPENSEARCH_NODE;
  const username = process.env.OPENSEARCH_USERNAME;
  const password = process.env.OPENSEARCH_PASSWORD;
  const index = process.env.OPENSEARCH_INDEX || "smart_tijori_products";
  const caCertPath = process.env.OPENSEARCH_CA_CERT_PATH;

  if (!url) {
    throw new Error(
      "Missing OpenSearch URL. Please configure OPENSEARCH_URL (or OPENSEARCH_NODE) in .env.local"
    );
  }

  // Validate URL protocol and hostname
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`Invalid OpenSearch URL protocol: ${parsed.protocol}. HTTPS is required for Aiven.`);
    }

    if (
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      process.env.ALLOW_LOCAL_OPENSEARCH !== "true"
    ) {
      throw new Error(
        "OpenSearch client is configured for Aiven cloud and will not silently fall back to localhost."
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("will not silently fall back")) {
      throw err;
    }
    throw new Error(`Invalid OpenSearch URL format: ${msg}`);
  }

  if (!username || !password) {
    throw new Error(
      "Missing OpenSearch authentication. Please configure OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD in .env.local"
    );
  }

  return { url, username, password, index, caCertPath };
}

export function createOpenSearchClient(customConfig?: Partial<OpenSearchConfig>): Client {
  const config = { ...getOpenSearchConfig(), ...customConfig };

  let caBuffer: Buffer | undefined;
  if (config.caCertPath) {
    const resolvedPath = path.isAbsolute(config.caCertPath)
      ? config.caCertPath
      : path.resolve(process.cwd(), config.caCertPath);

    if (fs.existsSync(resolvedPath)) {
      caBuffer = fs.readFileSync(resolvedPath);
    } else {
      throw new Error(`OpenSearch CA certificate not found at specified path: ${config.caCertPath}`);
    }
  }

  // Server-side only check
  if (typeof window !== "undefined") {
    throw new Error("OpenSearch client must never be instantiated or executed in browser/client context.");
  }

  return new Client({
    node: config.url,
    auth: {
      username: config.username!,
      password: config.password!,
    },
    ssl: {
      rejectUnauthorized: true, // TLS verification must never be disabled
      ...(caBuffer ? { ca: caBuffer } : {}),
    },
    maxRetries: 3,
    requestTimeout: 10_000,
  });
}

export function getOpenSearchClient(): Client {
  if (!cachedClient) {
    cachedClient = createOpenSearchClient();
  }
  return cachedClient;
}

export interface ClusterHealthReport {
  status: string;
  clusterName: string;
  version: string;
  luceneVersion?: string;
  healthy: boolean;
  targetIndex: string;
  indexExists: boolean;
}

export async function checkOpenSearchHealth(client?: Client): Promise<ClusterHealthReport> {
  const osClient = client || getOpenSearchClient();
  const config = getOpenSearchConfig();

  // Actual info call to Aiven OpenSearch
  const [infoRes, healthRes, existsRes] = await Promise.all([
    osClient.info(),
    osClient.cluster.health(),
    osClient.indices.exists({ index: config.index }),
  ]);

  const clusterName = infoRes.body?.cluster_name ?? "unknown";
  const version = infoRes.body?.version?.number ?? "unknown";
  const luceneVersion = infoRes.body?.version?.lucene_version;
  const status = healthRes.body?.status ?? "unknown";
  const indexExists = existsRes.body === true;

  return {
    status,
    clusterName,
    version,
    luceneVersion,
    healthy: status === "green" || status === "yellow",
    targetIndex: config.index,
    indexExists,
  };
}
