import "server-only";
import { Pool } from "pg";
import { certificate, serviceUrl, type Environment } from "../service-config.ts";

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
