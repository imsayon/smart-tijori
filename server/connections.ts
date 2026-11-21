import "server-only";
import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import { certificate, required, serviceUrl, ServiceConfigurationError, type Environment } from "./service-config.ts";

export { createPostgresPool } from "./db/pool.ts";
export { ServiceConfigurationError } from "./service-config.ts";

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
