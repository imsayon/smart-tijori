# Service boundaries and configuration

## Shared setup checkpoint · 21 November 2026

| Service | Shared instance | Verified here |
| --- | --- | --- |
| PostgreSQL 17.12 | `smart-tijori-postgres`, project `smart-tijori`, Free, `do-blr` | Authenticated `SELECT 1` with project CA and hostname verification |
| Kafka 4.3.2 | `smart-tijori-kafka`, project `smart-tijori`, Free, `do-blr` | mTLS connection and topic metadata with the Confluent client on pinned Node 24 |
| OpenSearch | Existing service in the discovery owner's separate Aiven project | Authenticated HTTPS cluster information with certificate verification |

The obsolete `pharmalink` service/project was deleted with explicit approval.
No application tables, topic, index, producer/consumer workflow or model connection
was created by the setup check. The startup page remains independent of live
services. See [platform commands](PLATFORM.md) for the local commerce and Kafka
proof and the inputs required for a live worker.

## Connect a teammate's checkout

1. Accept the Aiven organization invitation with the same email used in Linear.
   An organization invitation does not by itself grant project service access;
   obtain Developer access to `smart-tijori`. OpenSearch access is managed by its
   owner in her separate project. Current invitations/permissions belong in Linear.
2. Install the pinned Node/pnpm versions and run `CKJS_LINKING=dynamic pnpm install --frozen-lockfile`.
   pnpm permits the native install script only for the exact pinned Kafka client.
3. If absent, copy `.env.example` to `client/.env.local`. Fill the PostgreSQL URI,
   its CA path, Kafka brokers and mTLS paths, plus the OpenSearch HTTPS origin and
   separate username/password. Obtain credentials privately from each service
   owner/console. Aiven management membership and data-plane credentials are distinct.
4. Store certificate files under ignored `secrets/`: PostgreSQL CA; Kafka CA,
   client certificate and private key. Restrict the directory to the local user
   (`chmod 700 secrets`) and private files/environment to `600`. Paths must exist
   on each developer's machine; do not reuse another person's absolute paths.
5. Set `KAFKA_SECURITY_PROTOCOL=SSL` for the current service. SASL fields stay blank.
   Leave `OPENSEARCH_INDEX` unset until the discovery owner agrees its mapping and
   namespace. `commerce.events.v1` and `smart-tijori-projector-v1` in the local setup
   are proposed topic/group names; they are not provisioned resources.
6. Run `pnpm test:services`, then `pnpm check:services`. The latter reports each
   service independently, exits nonzero on failure and never creates resources.
   Do not paste credentials or raw connection exceptions into issues or chat.

Do not create independent Kafka groups on a shared topic assuming that isolates
writes: each group receives that topic's events. Agree bounded disposable schema,
topic/group and index namespaces before any integration writes. Coordinate with
free service limits; do not reset shared state.

## Data and acknowledgment flow

```text
Browser -> Next HTTP/session boundary -> Commerce -> PostgreSQL
                                  \-> Discovery -> OpenSearch
                                          \-> Commerce current-facts reader

PostgreSQL committed outbox -> Worker relay -> Kafka -> Worker consumer
                                                         | current facts from PostgreSQL
                                                         v
                                             Discovery projection writer -> OpenSearch
```

**PostgreSQL is the authority.** Commerce will commit stock/hold/order changes and
outbox intent in the same short transaction. A database commit establishes the
business outcome even if the HTTP response is lost. No network call to Kafka,
OpenSearch or AI belongs inside an allocation transaction. The worker reads the
outbox/current facts and invokes bounded expiry commands through commerce.

**Kafka delivers committed intent.** The relay marks an outbox claim sent only
after broker acknowledgment; a crash between those steps can publish a duplicate.
The consumer refreshes current facts and invokes the projection writer; it never
allocates or debits stock. Commit offsets only after every affected item is
successfully handled, unchanged under version guards, or a permanent invalid event
is durably quarantined. Temporary failures remain retryable. Broker acknowledgment,
offset commit and database commit are separate boundaries; this is an at-least-once
pipeline. Producer acknowledgment strength also depends on broker replication/ISR
configuration. See [Kafka delivery semantics](https://kafka.apache.org/41/design/design/).

**OpenSearch is an eventual projection.** Stable `storeId:productId` IDs and
monotonic `inventoryVersion` guards prevent older writes from replacing newer
facts. The writer replaces complete documents and reports each item's outcome.
Check [bulk item results](https://docs.opensearch.org/latest/api-reference/document-apis/bulk/),
including partial failures; a successful HTTP response does not make every item a
success. [External versioning](https://docs.opensearch.org/latest/api-reference/document-apis/index-document/)
can enforce strictly newer writes. An indexing acknowledgment does not imply search
visibility before refresh. Search/recovery hydrates candidates from current
PostgreSQL facts; checkout revalidates in a transaction. Retention gaps require
rebuilding the projection from current database truth.

## Access and environment names

| Service | Environment names | Access required |
| --- | --- | --- |
| PostgreSQL | `DATABASE_URL`, `DATABASE_CA_CERT_PATH` | Host/port/database, URL-encoded username/password and project CA certificate; appropriately scoped database role |
| Kafka | `KAFKA_BROKERS`, `KAFKA_SECURITY_PROTOCOL`, `KAFKA_CA_CERT_PATH`, `KAFKA_TOPIC`, `KAFKA_GROUP_ID` | Actual advertised TLS endpoints, topic/group namespace and produce/consume/group permissions |
| Kafka SASL | `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD` | Service-selected mechanism and credentials; use `SASL_SSL` |
| Kafka mTLS (current service) | `KAFKA_CLIENT_CERT_PATH`, `KAFKA_CLIENT_KEY_PATH` | Service client certificate/private key plus CA; use `SSL` |
| OpenSearch | `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`, `OPENSEARCH_INDEX` | HTTPS endpoint without embedded credentials, scoped service user and index permissions |
| OpenSearch custom CA | `OPENSEARCH_CA_CERT_PATH` | Needed only when Node's default trust store does not trust the endpoint certificate |

Aiven connection details determine the ports, auth method and certificates; do not
copy another service's port or credential. An Aiven management API token is not an
application data-plane credential and is not required by these client factories.

- PostgreSQL: follow [Aiven's Node guide](https://aiven.io/docs/products/postgresql/howto/connect-node)
  with certificate/hostname verification enabled. TLS encryption alone is
  insufficient: [Aiven documents](https://aiven.io/docs/platform/concepts/tls-ssl-certificates)
  that `sslmode=require` does not verify the server certificate. The implemented `pg`
  factory loads the CA file explicitly. When combining a connection URL with an
  explicit `ssl` object, normalize conflicting SSL URL parameters first;
  [node-postgres warns](https://node-postgres.com/features/ssl) that those parameters
  replace the supplied SSL object.
- Kafka: [Aiven Quick connect](https://aiven.io/docs/products/kafka/howto/connect-with-nodejs)
  recommends SASL/SCRAM-SHA-256 over TLS and also supports client certificates.
  Existing services may differ. Select the matching endpoint and verify the CA
  and hostname. Do not enable auth, change ACLs or create topics merely to inspect
  connectivity. The architecture selects the maintained Confluent JavaScript client,
  while Aiven's guide currently demonstrates `node-rdkafka`. The
  [Confluent client documentation](https://docs.confluent.io/kafka-clients/javascript/current/overview.html)
  describes native runtime requirements. On Linux, the pinned client falls back
  to compiling from source on Node 26.13.1. Dynamic linking avoids GNU ar MRI parsing of scoped pnpm paths. The build needs Python 3, make, a
  C/C++ compiler, and Perl with its core modules to build OpenSSL. After switching
  Node major versions, start with a fresh `node_modules` to replace the previous
  native binary.
- OpenSearch: [Aiven's connection guide](https://aiven.io/docs/products/opensearch/howto/connect-with-nodejs)
  supplies an authenticated service URI. Split endpoint and credentials for this
  app, use HTTPS, retain certificate verification and load a custom CA only if
  required. Use the [OpenSearch JS client](https://docs.opensearch.org/latest/clients/javascript/index/)
  in server code, with separate query and writer permissions where available.

Keep secrets in ignored `client/.env.local`/`secrets/` or the runtime's secret store. Do not
log connection URLs, echo passwords, publish keys or use `NEXT_PUBLIC_*` for them.
Certificate paths refer to files on each executing host, not browser assets.

## Client ownership and remaining lifecycle work

The factories in `server/connections.ts` validate configuration only when called;
imports and builds do not demand credentials or connect. They are guarded by
`server-only`; standalone Node commands use `--conditions=react-server`. The caller
owns each returned pool/client and must close it. The PostgreSQL pool is capped
at two connections per instance. The worker accepts an injected discovery writer
and owns the Kafka lifecycle. The integrated web app needs PostgreSQL and OpenSearch in
live composition, plus optional model access for AI-assisted parsing. It does not
produce/consume Kafka directly. The worker needs PostgreSQL, Kafka and OpenSearch;
it runs outside request handlers and needs no model key.

Reuse one bounded PostgreSQL pool per process/runtime instance, with connection
budgets shared across web instances and worker. Transactions use one checked-out
client with rollback/release in all paths. Reuse OpenSearch clients/connections.
The worker connects producer/consumer once, applies bounded retries, handles
rebalances without acknowledging unfinished work and shuts down on signals: stop
new work, finish or safely abandon claims, flush publication, disconnect Kafka,
close search and end the database pool. Never make a producer/consumer per HTTP
request. [Pool lifecycle guidance](https://node-postgres.com/features/pooling)
covers release, idle error handling and shutdown.

## Development dependencies

The platform proof below runs locally with dedicated PostgreSQL and Kafka
containers. The other tracks supply their own test commands.

| Mode | Required live services | Controlled dependencies |
| --- | --- | --- |
| Startup page: `pnpm dev` or `pnpm build`/`pnpm start` | None | None |
| Web/HTTP component work | None | Explicit HTTP scenarios for UI; recording commands for real handler checks |
| Commerce/event platform | Isolated PostgreSQL and Kafka | Recording projection writer; no OpenSearch/model required |
| Discovery/operations component proof | Isolated OpenSearch | Controlled stock, commands and pipeline readers; deterministic model responses |
| Live AI evaluation | OpenSearch and selected model access | Controlled facts allowed, labeled explicitly |
| Integrated application and worker | PostgreSQL, Kafka and OpenSearch | No silent fixtures; model access optional with explicit rules fallback |

## Remaining verification

The read-only checks do not prove schema/topic/index write permissions, stock
safety, publication acknowledgment, consumer retries, versioned projections or
search freshness. Those require the owners' real modules and an explicitly scoped
integration scenario. Teammates' independent checkouts, model access and deployment
host compatibility remain to be verified. No application/worker was deployed.

[Aiven's Kafka free tier](https://aiven.io/docs/products/kafka/free-tier/kafka-free-tier)
has capacity/retention restrictions and excludes Kafka Connect. Recheck the actual
service limits before provisioning test namespaces. Keep pools small across all
web processes and workers; closing the diagnostic script releases its clients.
