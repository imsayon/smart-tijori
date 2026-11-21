import "server-only";
import { readFileSync } from "node:fs";
import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import { Pool } from "pg";

type Environment = NodeJS.ProcessEnv;

export class ServiceConfigurationError extends Error {}

function required(env: Environment, name: string): string {
  const value = env[name];
  if (!value?.trim()) throw new ServiceConfigurationError(`Missing ${name}`);
  return value;
}

function serviceUrl(env: Environment, name: string, protocols: string[]): URL {
  try {
    const url = new URL(required(env, name));
    if (!protocols.includes(url.protocol) || !url.hostname) throw new Error();
    return url;
  } catch (error) {
    if (error instanceof ServiceConfigurationError) throw error;
    throw new ServiceConfigurationError(`Invalid ${name}`);
  }
}

function certificate(env: Environment, name: string): string {
  try {
    return readFileSync(required(env, name), "utf8");
  } catch (error) {
    if (error instanceof ServiceConfigurationError) throw error;
    throw new ServiceConfigurationError(`Cannot read ${name}`);
  }
}

// Construct once in application/worker composition; importing this module never connects.
export function createPostgresPool(env: Environment = process.env): Pool {
  const url = serviceUrl(env, "DATABASE_URL", ["postgres:", "postgresql:"]);
  // pg URL SSL parameters replace its explicit ssl object, including the trusted CA.
  for (const name of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "sslpassword", "sslnegotiation"])
    url.searchParams.delete(name);

  const pool = new Pool({
    connectionString: url.toString(),
    ssl: { ca: certificate(env, "DATABASE_CA_CERT_PATH"), rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  pool.on("error", () => console.error("PostgreSQL idle connection failed"));
  return pool;
}

export function createKafka(env: Environment = process.env): KafkaJS.Kafka {
  const brokers = required(env, "KAFKA_BROKERS").split(",").map((host) => host.trim());
  for (const broker of brokers) {
    try {
      const url = new URL(`tcp://${broker}`);
      if (!url.hostname || !url.port || url.username || url.password || url.pathname || url.search || url.hash)
        throw new Error();
    } catch {
      throw new ServiceConfigurationError("Invalid KAFKA_BROKERS; use host:port entries");
    }
  }

  const protocol = required(env, "KAFKA_SECURITY_PROTOCOL");
  if (protocol !== "SSL" && protocol !== "SASL_SSL")
    throw new ServiceConfigurationError("Invalid KAFKA_SECURITY_PROTOCOL; use SSL or SASL_SSL");

  const config: KafkaJS.CommonConstructorConfig = {
    kafkaJS: {
      brokers,
      clientId: "smart-tijori",
      connectionTimeout: 10_000,
      requestTimeout: 10_000,
      logLevel: KafkaJS.logLevel.ERROR,
    },
    "security.protocol": protocol === "SSL" ? "ssl" : "sasl_ssl",
    "ssl.ca.pem": certificate(env, "KAFKA_CA_CERT_PATH"),
    "enable.ssl.certificate.verification": true,
    "ssl.endpoint.identification.algorithm": "https",
  };

  if (protocol === "SSL") {
    config["ssl.certificate.pem"] = certificate(env, "KAFKA_CLIENT_CERT_PATH");
    config["ssl.key.pem"] = certificate(env, "KAFKA_CLIENT_KEY_PATH");
  } else {
    const mechanism = required(env, "KAFKA_SASL_MECHANISM");
    if (!["PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512"].includes(mechanism))
      throw new ServiceConfigurationError("Invalid KAFKA_SASL_MECHANISM");
    config["sasl.mechanisms"] = mechanism;
    config["sasl.username"] = required(env, "KAFKA_SASL_USERNAME");
    config["sasl.password"] = required(env, "KAFKA_SASL_PASSWORD");
  }
  return new KafkaJS.Kafka(config);
}

export function createOpenSearchClient(env: Environment = process.env): OpenSearchClient {
  const url = serviceUrl(env, "OPENSEARCH_URL", ["https:"]);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new ServiceConfigurationError("Invalid OPENSEARCH_URL; use the HTTPS origin without credentials");

  return new OpenSearchClient({
    node: url.origin,
    auth: {
      username: required(env, "OPENSEARCH_USERNAME"),
      password: required(env, "OPENSEARCH_PASSWORD"),
    },
    ssl: {
      rejectUnauthorized: true,
      ...(env.OPENSEARCH_CA_CERT_PATH ? { ca: certificate(env, "OPENSEARCH_CA_CERT_PATH") } : {}),
    },
    requestTimeout: 10_000,
    maxRetries: 0,
  });
}
