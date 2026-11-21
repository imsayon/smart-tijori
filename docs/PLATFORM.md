# Commerce and event platform

The shared contracts live in `server/contracts/commerce.ts` and
`server/contracts/events.ts`. Create a database binding with
`createDatabase(pool, schema)`, then pass that binding to
`createCommerceCommands`, `createCommerceFacts`, or `createPipelineReader`.
Web adapters supply the actor from a verified session. Use a stable opaque actor
ID, with an explicit branch allowlist for an operator. A new cart has a null
store until the shopper selects a branch. Command failures return a typed code
and a safe message. For stock conflicts, `productIds` identifies affected lines.
An unexpected database failure throws and needs normal server error handling.

Prices and totals are integer paise. Carts accept at most 24 distinct products
and up to 99 units per line. Restock accepts 1 to 1,000 units. Timestamps are UTC
ISO strings. Holds last exactly five minutes. A keyed retry returns the first
committed outcome, including its original timestamps. Fetch the current hold
for a fresh state and clock. Use a new key for a new attempt after a business
rejection. An order has simulated payment, and saving interest records demand.

## Run the local platform proof

From the repository root with pinned Node/pnpm and Docker Compose:

```sh
pnpm install --frozen-lockfile
docker compose -f infra/platform-test.compose.yml up --wait
docker compose -f infra/platform-test.compose.yml exec -T kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server 127.0.0.1:19093 --create \
  --topic commerce.events.platform-local.v1 --partitions 1 --replication-factor 1
pnpm test:platform
```

The suite targets the Compose database at `127.0.0.1:15439`, PostgreSQL schema
`st_platform_local`, the named local Kafka topic, and consumer group
`st-projector-platform-local-v1`. It uses two synthetic stores and 24 products.
The opening fixture has one unit of `tea-250` and `detergent-front-1l` at
`blr-01`. The platform suite uses the production commands, relay, consumer,
and a recording writer that keeps versioned documents in memory. It requires
fresh local fixtures and leaves the data available for inspection. To reset
only the Compose resources created above:

```sh
docker compose -f infra/platform-test.compose.yml down --volumes
```

## Configure an agreed live namespace

Once the owners have agreed the disposable or deployment resources, set
`ST_DB_SCHEMA`, `KAFKA_TOPIC`, and `KAFKA_GROUP_ID` explicitly. Reuse
the private TLS values from [service setup](SERVICES.md).
`pnpm db:migrate` applies the ordered SQL migrations under a schema advisory
lock. Use `pnpm db:migrate --seed` for explicit synthetic data in a disposable
schema. Seed reruns preserve existing inventory counts.

Create the agreed Kafka topic explicitly. Bind the worker by setting
`ST_PROJECTION_WRITER_MODULE` to the discovery adapter file and running
`pnpm worker`. The module exports `createProjectionWriter()`, which supplies
`writeProjection(offers, signal?)` and `close()`. The writer returns one
result per input, keyed by `storeId:productId`. It settles all writes before
resolving and treats an equal or newer indexed version as unchanged. Failed
items are explicitly retryable or permanent. The worker waits for in-flight
work during shutdown, so the adapter must honor cancellation or have bounded
request timeouts.

The relay records publication only after broker acknowledgment and a valid lease
check. A crash before publication is recorded can produce duplicates.
The consumer fetches current offers and advances the partition only after
complete writer handling or durable quarantine. Temporary, partial, and
incomplete writer results keep the offset pending. `readPipelineFacts`
reports recorded broker acknowledgments, completed writer responses, pending
outbox age, retry counts and quarantine. Actual search visibility requires a
search query. Malformed records without a trusted store appear in
`unattributedQuarantineCount`. Inspect raw quarantine records only from the
restricted database.

After a known Kafka retention gap, rebuild each store from PostgreSQL with
`rebuildStoreProjection(db, facts, writeProjection, storeId)` against the
agreed index, then process the retained tail with the normal consumer.
Version guards allow live updates to overlap the rebuild. The worker starts a
new group at the earliest retained record. Monitoring for retention gaps and
measuring live search visibility belong to the integration run.
