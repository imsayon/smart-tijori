# SmartTijori

SmartTijori is a neighborhood-retail commerce prototype for shopping pantry and household essentials from a selected local store branch. It brings together a shopper storefront, branch-scoped inventory, timed checkout reservations, cashier point of sale (POS), an operations workbench, and an asynchronous product-search projection.

**Hosted prototype:** https://smart-tijori.onrender.com

This README is the project-level guide. It explains what the product does, how the main user journeys work, how the system is structured, how data moves through the platform, how to run the project locally, and how to verify it. The focused documents in docs/ remain the detailed operational runbooks.

---

## Contents

1. [Project overview](#1-project-overview)
2. [Product capabilities and user journeys](#2-product-capabilities-and-user-journeys)
3. [Architecture overview](#3-architecture-overview)
4. [Core system principles](#4-core-system-principles)
5. [How commerce works](#5-how-commerce-works)
6. [Events, Kafka and OpenSearch](#6-events-kafka-and-opensearch)
7. [Operations, inventory and POS](#7-operations-inventory-and-pos)
8. [Payments and external integrations](#8-payments-and-external-integrations)
9. [Repository structure](#9-repository-structure)
10. [Technology stack](#10-technology-stack)
11. [Local development](#11-local-development)
12. [Environment configuration](#12-environment-configuration)
13. [Database and infrastructure commands](#13-database-and-infrastructure-commands)
14. [Testing and verification](#14-testing-and-verification)
15. [Security and engineering rules](#15-security-and-engineering-rules)
16. [Deployment](#16-deployment)
17. [Additional documentation](#17-additional-documentation)
18. [Known boundaries and limitations](#18-known-boundaries-and-limitations)

---

## 1. Project overview

SmartTijori models a local retailer that sells products through two channels:

- A shopper-facing web storefront where customers browse a branch catalog, manage a cart, reserve stock and place orders.
- A physical cashier workflow where an authorized operator scans or enters a barcode and records a sale.

Both channels interact with the same branch inventory authority. The central problem is preventing the same unit of stock from being promised to two different transactions at the same time.

The project also provides operations views for branch inventory and the asynchronous event/search pipeline. Product discovery can use OpenSearch to find candidate products, but current PostgreSQL facts are used for price and availability, and inventory is checked again during checkout.

The product principles represented in the storefront are:

- **ShelfSync:** one stock view shared by the shopper storefront and cashier counter.
- **LastOne:** the final unit can only be allocated once.
- **CartLock:** checkout places a time-limited hold on requested inventory.
- **ZeroDeadEnd:** when stock is unavailable, the shopper can review alternatives rather than getting stuck.

SmartTijori is a prototype with distinct development and live-integration modes. A successful UI test or build does not establish that every external service is configured or live. Fixture mode is not live PostgreSQL inventory; search indexing is asynchronous; and simulated payments are not real payment captures.

## 2. Product capabilities and user journeys

### 2.1 Shopper storefront

The shopper experience is implemented in the Next.js application. A typical journey is:

1. Open the storefront and select a supported branch, such as Bengaluru or Mysuru.
2. Browse the catalog for that branch.
3. Add products and quantities to the cart.
4. Proceed to checkout and request a stock reservation.
5. Complete the order while the reservation is still active.
6. View the resulting order or receipt experience.

A cart belongs to a shopper actor. The server resolves that actor through its session boundary; the browser must not choose an arbitrary owner identity or submit trusted prices.

The current commerce contracts allow up to 24 distinct cart lines and up to 99 units per line.

### 2.2 Timed checkout reservation

Checkout does not assume that an item shown as available a few moments earlier is still available. The reservation command checks stock again in PostgreSQL.

A successful hold lasts **59 seconds**. The server returns both the expiry timestamp and its current time. The client uses those values to display a countdown while compensating for differences between the browser clock and server time.

The countdown is only a display. It does not release stock. The server-side commerce command and worker expiry process determine the actual reservation state.

### 2.3 Stock conflict and recovery

A stock conflict can happen when another shopper or the cashier consumes stock before checkout reserves it.

The commerce response uses a typed error and can identify all affected product IDs. The recovery experience can then:

- Show each unavailable cart item.
- Offer eligible alternatives where available.
- Let the shopper remove unavailable lines.
- Preserve cart lines that were not affected.
- Retry reservation through the normal checkout command.

An alternative is a suggestion, not a guaranteed allocation. The new reservation is checked again against current PostgreSQL inventory.

### 2.4 Shopper account and interest

The commerce contracts include shopper-owned cart, hold and order reads, as well as a way to save interest in a product at a branch. Saving interest records demand; it does not create stock or guarantee a restock date.

Firebase Authentication is documented for web account identity. The application server uses verified identity and session information to establish the shopper actor.

### 2.5 Cashier / Point of Sale

The cashier UI is under /ops/pos. It supports a scanner-style barcode field and manual barcode entry.

The POS request passes through an HTTP adapter that verifies the operator session and branch access. The commerce command checks the operator actor and allowed branch again before performing the sale.

POS behavior includes:

- Barcode lookup against active mappings for the branch.
- A seeded demonstration barcode format of ST:<product-id>.
- Not-found behavior for unknown or inactive codes.
- Quantity validation.
- A stock check that respects online holds.
- Idempotent command submission to avoid duplicate sale recording.
- A receipt with branch, sale ID, timestamp, line details, total and resulting inventory versions.

A cashier sale can be rejected with STOCK_LOCKED_ONLINE when releasing online holds would be necessary to cover the requested sale. Insufficient stock without that condition is represented separately.

The committed POS transaction records the sale, stock debit, stock movement, inventory version, outbox event and idempotency result together.

### 2.6 Operations Workbench

The operations area is rooted at /ops and provides:

| Route | Purpose |
| --- | --- |
| /ops | Branch operations overview |
| /ops/inventory | Stock facts and recent stock movements |
| /ops/diagnostics | Outbox and search-projection pipeline diagnostics |
| /ops/pos | Cashier barcode sale workflow |

Inventory views include stock on hand, held quantities, available quantities, inventory versions and recent movements. Diagnostics views include pending outbox work, broker acknowledgment timestamps, projection acceptance, retries, quarantine counts and recent event metadata.

The inventory and diagnostics endpoints are read-only. They do not provide controls to adjust stock, restock, publish Kafka messages, reset consumers or change operational state.

Live operations requests derive the branch from a verified operator session. A store ID supplied in a query parameter is accepted only if it matches the operator's authorized branch. Responses are marked no-store.

### 2.7 Product discovery

The catalog supports PostgreSQL-backed literal search and OpenSearch-backed product discovery. The configured mode is selected with ST_CATALOG_SOURCE.

OpenSearch is useful for indexed candidate retrieval and discovery. The server then hydrates candidate products with current PostgreSQL offer facts. Checkout and POS always rely on PostgreSQL commands for the final stock decision.

---

## 3. Architecture overview

The repository intentionally contains one pnpm package, one Next.js application and one Node worker process entry point. The worker is a separate runtime process, not a second web application.

~~~text
 Shopper / cashier browser
          |
          v
 Next.js application (client/)
 Pages, components and API route handlers
          |
          v
 HTTP boundary: validation, sessions, authorization
          |
          v
 Commerce commands and read-side facts
          |
          v
 PostgreSQL — authoritative commerce state
    |             |                 |
    |             |                 +--> Transactional outbox
    |             |                           |
    |             |                           v
    |             |                       Node worker
    |             |                       /        |
    |             |              outbox relay     consumer
    |             |                   |              |
    |             |                   v              v
    |             |                 Kafka     current DB facts
    |             |                                  |
    |             |                                  v
    |             |                          projection writer
    |             |                                  |
    |             +----------------------------------+
    |                                                |
    +--------------------------------------------> OpenSearch
                                                     |
                                            search candidates
                                                     |
                                                     v
                                           PostgreSQL hydration
~~~

### Main components

**Next.js application**

Renders the storefront and operations interfaces and exposes API route handlers. Browser components call the application's HTTP API; they do not connect directly to databases or message brokers.

**HTTP and session boundary**

Validates requests, resolves shopper/operator actors from trusted server-side session state, applies branch permissions and translates domain outcomes into HTTP responses.

**Commerce layer**

Implements cart, reservation, order, POS, restock/interest and inventory behavior. It owns the transaction boundary for stock-affecting commands.

**PostgreSQL**

Stores branch inventory, product facts, carts, reservations, orders, stock movements, idempotency results, outbox events and pipeline bookkeeping. It is the source of truth for commerce.

**Kafka**

Carries committed event intent from the outbox relay to the asynchronous projection consumer. It is not called directly by shopper or cashier browser code.

**Node worker**

Runs the outbox relay and event consumer, triggers due-hold expiry, and performs payment reconciliation/refund work when payment configuration is present.

**OpenSearch**

Stores an asynchronously maintained search projection. It improves discovery but does not allocate stock or decide final checkout availability.

---

## 4. Core system principles

### 4.1 PostgreSQL alone allocates stock

The inventory allocation decision happens in a PostgreSQL transaction using database locking. A browser display, search document or event message cannot allocate inventory.

### 4.2 Stock changes and event intent commit together

When a commerce operation changes inventory, it also writes the corresponding outbox record in the same transaction. This avoids committing stock changes and then losing the notification because a separate Kafka call failed.

### 4.3 No external calls while holding stock locks

Do not call Kafka, OpenSearch, payment services or AI models from inside the transaction that holds inventory locks. Those operations run after the database transaction, or in their own process/workflow.

### 4.4 Idempotency is part of the domain

Write commands accept stable operation keys. The idempotency scope includes actor kind, actor ID, operation and key. A request fingerprint prevents the same key from being reused with a different payload.

A retry using the same key and same payload returns the original committed result. Reusing that key with a changed payload returns IDEMPOTENCY_CONFLICT. After a business rejection, a new attempt needs a new key.

### 4.5 Search is eventually consistent

Search documents are derived from PostgreSQL facts. They may lag behind a recent stock change. Search results are hydrated from current database facts, and checkout revalidates stock transactionally.

### 4.6 Money and time are explicit

- Prices and totals are integer paise.
- API timestamps are UTC ISO strings.
- Authoritative operation time comes from the database where required.
- Reservation duration is 59 seconds.

### 4.7 Bounded operations

| Contract | Current limit |
| --- | ---: |
| Distinct cart products | 24 |
| Quantity per cart line | 99 |
| Restock quantity | 1 to 1,000 |
| Product-facts batch | 100 product IDs |
| Reservation duration | 59 seconds |

These are defined by the commerce contracts and should be treated as backend constraints, not just UI validation.

---

## 5. How commerce works

### 5.1 Cart

A shopper's cart can initially have no selected branch. Once a branch is selected, product lines are associated with that branch. Product names and prices are read from trusted product facts rather than accepted from the browser as authoritative values.

### 5.2 Reservation lifecycle

A reservation (also called a hold) follows this general lifecycle:

~~~text
Cart
 |
 | reserve request
 v
Validate shopper and cart ownership
 |
 v
Lock relevant cart and inventory rows
 |
 v
Read current branch inventory and price facts
 |
 +---- stock unavailable ----> typed stock conflict
 |
 v
Create reservation and reservation lines
 |
 v
ACTIVE hold (59 seconds)
 |
 +---- shopper releases ------> RELEASED
 |
 +---- expiry sweep ----------> EXPIRED
 |
 +---- order confirmation ----> CONSUMED
~~~

The server checks the cart owner, validates quantities and reads inventory under the database transaction. If the requested quantity is no longer available, the command returns a typed rejection identifying affected products.

A hold response includes expiresAt and serverNow so the UI can render a timer without assuming the device clock is correct.

### 5.3 Order confirmation

Order placement verifies that the reservation belongs to the shopper and is still active. The commerce transaction transitions the reservation, creates the order and order lines, records the stock movement and inventory version changes, clears the cart lines as appropriate, and writes the order event to the outbox.

The order payment mode can be SIMULATED or RAZORPAY. SIMULATED does not represent an external payment capture.

### 5.4 Release and expiry

A shopper can release an active hold. The worker also runs a periodic expiry sweep and invokes the commerce expiry command for holds whose deadlines have passed. The client countdown is informational; only the server changes reservation state.

### 5.5 POS sale

The POS command resolves the operator's branch, validates the barcode, reads the current PostgreSQL price and inventory, checks online holds, and then records the sale transactionally.

The idempotency key is scoped to the operator and operation. If a response is lost and the cashier retries the same request, the original result can be replayed instead of recording a second sale.

### 5.6 Interest and restock

The contracts include a bounded restock command and a shopper interest command. Interest is a record of demand. A stock increase must go through the authorized commerce restock operation; it must never be inferred from an interest record.

---

## 6. Events, Kafka and OpenSearch

### 6.1 Event types

The current event contract defines:

- inventory.changed — includes store ID, product ID and inventory version.
- order.placed — includes store ID, order ID and affected product IDs.

Events include an event ID, schema version and UTC occurrence timestamp.

### 6.2 Transactional outbox relay

After a commerce transaction commits, the worker claims an unpublished outbox record using a database lease and row locking with SKIP LOCKED. It publishes the event to the configured Kafka topic. The worker marks the outbox item published only after the broker acknowledges the record and the lease remains valid.

Failed publication is deferred with bounded retry backoff.

There is an unavoidable crash boundary between Kafka acknowledgment and saving the published marker in PostgreSQL. A crash in that window can lead to duplicate publication. The pipeline therefore expects duplicate-safe processing.

### 6.3 Consumer validation and projection

The consumer validates an event before trusting it. It checks schema version, event identity, timestamp, payload shape and that the Kafka key matches the expected event key.

For valid events it:

1. Reads current product facts from PostgreSQL.
2. Checks that the database facts are consistent with the event.
3. Invokes the OpenSearch projection writer.
4. Records acceptance, retry state or durable quarantine.
5. Commits the Kafka offset only after complete handling.

The consumer does not debit inventory. It reads current stock facts and updates a search projection.

### 6.4 Version guards

Projection documents have stable branch/product identities and inventory versions. A write with an equal or older version is treated as unchanged rather than overwriting newer facts.

Bulk indexing is evaluated item by item. A successful HTTP response alone is not treated as proof that every document was updated.

### 6.5 Delivery and recovery semantics

The pipeline is **at-least-once**, not exactly-once end-to-end:

- PostgreSQL transaction commit and Kafka broker acknowledgment are separate boundaries.
- A publication can be duplicated after a crash between broker acknowledgment and outbox acknowledgment persistence.
- Consumer offset commit happens after projection handling.
- Temporary projection failures remain retryable.
- Permanent invalid events are durably quarantined.
- Search visibility may lag indexing until the search engine refreshes.

After a known Kafka retention gap, the documented recovery path is to rebuild a branch projection from current PostgreSQL inventory facts, then process the retained event tail.

---

## 7. Operations, inventory and POS

### 7.1 Branch-scoped authorization

An operator actor contains an ID and a list of authorized store IDs. In live web flows this identity is resolved from the verified operator session. Request bodies must not be treated as the source of operator identity.

The operations API derives its store from that server-side actor. If a request includes a store query parameter, it must match the authorized branch.

### 7.2 Inventory facts

The inventory reader runs a repeatable-read, read-only transaction to capture a consistent view of current stock. It returns:

- Product ID.
- Stock on hand.
- Currently held quantity.
- Available quantity.
- Inventory version.
- Up to 20 recent stock movements, including movement type, reference, delta and timestamp.

Movement kinds in the commerce contract include ORDER, POS and RESTOCK.

### 7.3 Pipeline diagnostics

The pipeline reader reports operational facts such as:

- Unpublished outbox count and oldest pending timestamp.
- Last recorded broker acknowledgment.
- Last accepted projection timestamp.
- Last recorded error.
- Projection retry count.
- Quarantine count and unattributed quarantine count.
- Recent event metadata.

These are persisted pipeline facts, not a guarantee of instantaneous Kafka or OpenSearch health. Interpret them together with the timestamps and error fields shown by the dashboard.

### 7.4 Read-only boundary

The operations inventory and diagnostics endpoints are read-only. The dashboard does not allocate stock, restock products, publish Kafka events, reset consumers, or edit database state.

---

## 8. Payments and external integrations

### 8.1 Payment modes

The commerce order model includes:

- SIMULATED — prototype checkout without a real external payment capture.
- RAZORPAY — payment-provider-backed flow when configured and enabled.

Do not infer that live payments are enabled simply because the integration code exists.

### 8.2 Razorpay controls

The server-side payment adapter validates provider response shapes, verifies webhook signatures using HMAC with timing-safe comparison, reconciles captured payments, and tracks pending refund work.

A live Razorpay key is ignored unless ST_ENABLE_LIVE_PAYMENTS=true. Keep staging on Test Mode and use a distinct webhook secret. The worker performs reconciliation when valid payment configuration is present.

### 8.3 Authentication

The repository documents Firebase Authentication for web accounts. Public Firebase web configuration is supplied through the named NEXT_PUBLIC_ST_FIREBASE_* settings; server credentials must remain private. Operator membership maps a verified Firebase UID to a branch.

### 8.4 Optional AI assistant

The project documents an optional server-side Gemini assistant configured through GEMINI_API_KEY and GEMINI_MODEL. It is intended for general shopping guidance and should not access orders, payment details or stock. AI access is optional and must not be placed in the inventory allocation path.

---

## 9. Repository structure

The repository is one pnpm package. Main locations:

| Path | Responsibility |
| --- | --- |
| client/app/ | Next.js App Router pages, layouts and API route entry points |
| client/app/(shop)/ | Shopper-facing route group |
| client/app/ops/ | Operations Workbench routes |
| client/components/shop/ | Storefront, cart, checkout, recovery and shopper UI |
| client/components/ops/ | Operations, inventory, diagnostics and POS UI |
| client/lib/api-client/ | Typed browser-to-HTTP API client |
| client/lib/session/ | Client/session integration helpers |
| server/http/ | HTTP handlers, request validation, sessions and auth adapters |
| server/commerce/ | Commerce commands, inventory operations and read-side facts |
| server/contracts/ | Shared TypeScript commerce and event contracts |
| server/db/ | Database binding, migrations, seeds and runtime composition |
| server/events/ | Outbox relay, event validation/projection handling and diagnostics |
| server/discovery/ | Search integration and OpenSearch projection code |
| server/payments/ | Payment provider adapter and reconciliation logic |
| server/worker.ts | Long-running worker lifecycle |
| server/run-worker.ts | Worker process composition and shutdown entry point |
| infra/ | Local Compose setup, index setup, catalog sync and deployment launcher |
| tests/ | Unit, HTTP, security, browser, API and platform integration checks |
| docs/ | Detailed user, platform, service and demo-data documentation |

For module ownership and development constraints, read AGENTS.md.

---

## 10. Technology stack

Pinned versions are declared in package.json and .nvmrc.

| Layer | Technology |
| --- | --- |
| Language | TypeScript / JavaScript |
| Runtime | Node.js 26.13.1 |
| Package manager | pnpm 12.21.0 |
| Web framework | Next.js 16.4.6 |
| UI | React 19.3.1 |
| Styling | Tailwind CSS 4 |
| Validation | Zod 4 |
| Primary database | PostgreSQL (documented shared service: PostgreSQL 17.12) |
| Event transport | Kafka via @confluentinc/kafka-javascript |
| Search projection | OpenSearch |
| Authentication | Firebase Authentication / server-side operator session |
| Optional assistant | Gemini API |
| Payment integration | Razorpay |
| Tests | Vitest, Node test runner, Testing Library and Playwright tooling |
| Hosting | Render hosted prototype; Aiven-managed data services documented |

The project is not a pnpm monorepo. It is one package with a Next.js app and a separate Node worker entry point.

---

## 11. Local development

### 11.1 Prerequisites

- Node.js 26.13.1 (see .nvmrc).
- pnpm 12.21.0.
- A shell with environment-variable support.
- For live platform checks: Docker Compose and explicitly configured PostgreSQL, Kafka and OpenSearch dependencies.

Install the pinned dependencies:

~~~sh
nvm use
CKJS_LINKING=dynamic pnpm install --frozen-lockfile
~~~

On Windows PowerShell:

~~~powershell
nvm use
$env:CKJS_LINKING = "dynamic"
pnpm install --frozen-lockfile
~~~

### 11.2 Recommended first run: shopper fixture mode

For a UI and shopper-flow development experience that does not require live service credentials:

~~~sh
pnpm dev:shopping
~~~

Then open:

- Storefront: http://localhost:3000
- Operations: http://localhost:3000/ops
- Inventory: http://localhost:3000/ops/inventory
- Diagnostics: http://localhost:3000/ops/diagnostics
- POS: http://localhost:3000/ops/pos

The dev:shopping script sets SMARTTIJORI_DEMO_MODE=true and uses the in-memory commerce fixture adapter documented for local shopper development. It is intended for UI and shopper-flow work. It is not proof of PostgreSQL locking, Kafka delivery or live OpenSearch behavior. Live-only operations facts may be unavailable in fixture mode.

### 11.3 Start the normal application

~~~sh
pnpm dev
~~~

This starts Next.js but does not itself provision or configure PostgreSQL, Kafka, OpenSearch, Firebase or payment credentials. Routes that need live services require the corresponding runtime configuration.

### 11.4 Production build

~~~sh
pnpm build
pnpm start
~~~

Build/start success alone does not prove that remote services are reachable or that the worker is running.

---

## 12. Environment configuration

The complete list of variable names and comments is in .env.example. For local app and service checks, the repository documentation expects the private environment file at client/.env.local. Worker and migration commands also support injected environment variables or that file.

Create the local file:

~~~sh
cp .env.example client/.env.local
~~~

Then obtain actual values and credentials from the relevant service owners. Do not copy secrets into source control or commit local environment files.

### 12.1 Main environment groups

| Group | Variables | Purpose |
| --- | --- | --- |
| PostgreSQL | DATABASE_URL, DATABASE_CA_CERT_PATH, ST_DB_SCHEMA | Connection URI, verified TLS CA path and selected schema |
| Catalog mode | ST_CATALOG_SOURCE | postgres or opensearch catalog candidate source |
| Kafka | KAFKA_BROKERS, KAFKA_SECURITY_PROTOCOL, KAFKA_TOPIC, KAFKA_GROUP_ID | Broker endpoints and explicitly agreed topic/group |
| Kafka TLS / SASL | KAFKA_CA_CERT_PATH, KAFKA_CLIENT_CERT_PATH, KAFKA_CLIENT_KEY_PATH, KAFKA_SASL_* | Service-specific TLS/mTLS or SASL credentials |
| OpenSearch | OPENSEARCH_URL, OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD, OPENSEARCH_INDEX, optional CA path | Search cluster and index access |
| Operator | ST_OPS_OPERATOR_TOKEN, ST_OPS_STORE_ID | Branch-scoped operator access for the documented hosted setup |
| Session / Firebase | SESSION_SECRET, ST_FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS, NEXT_PUBLIC_ST_FIREBASE_* | Session signing and Firebase web/server configuration |
| Optional AI | GEMINI_API_KEY, GEMINI_MODEL | Server-side assistant |
| Payments | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, ST_ENABLE_LIVE_PAYMENTS | Test/live provider and webhook configuration |
| India demo seed | ST_ALLOW_INDIA_DEMO_SEED, ST_SEED_INDIA_ON_START | Explicitly controlled synthetic demo seeding |

### 12.2 TLS and secrets

- Keep PostgreSQL, Kafka and OpenSearch credentials in private environment storage.
- Keep certificate/key files in an ignored secrets/ directory or outside the checkout.
- Use the actual host, port, authentication mode and CA file supplied for each service. Do not assume service endpoints share a port or auth method.
- Preserve certificate and hostname verification. Do not disable TLS verification to make a connection succeed.
- Never put server secrets in NEXT_PUBLIC_* variables.
- Do not paste passwords, connection URLs, private keys or raw credential-bearing errors into issues or chat.

### 12.3 Check service connectivity

~~~sh
pnpm test:services
pnpm check:services
~~~

The service check reports PostgreSQL, Kafka and OpenSearch independently and exits nonzero if required configuration or connectivity is missing. It does not create services, topics, schemas or indexes.

For exact onboarding and service permissions, see docs/SERVICES.md.

---

## 13. Database and infrastructure commands

### 13.1 Migrations

Apply the ordered SQL migrations to the explicitly selected schema:

~~~sh
pnpm db:migrate
~~~

For a disposable schema where synthetic seed data is explicitly intended:

~~~sh
pnpm db:migrate --seed
~~~

The migration process uses a schema advisory lock. Seed reruns preserve existing inventory counts. Never point seed/reset operations at a shared or production schema without explicit approval and scope.

### 13.2 OpenSearch index setup and seed

The repository provides:

~~~sh
pnpm setup:opensearch
pnpm seed:opensearch
~~~

These commands require the configured OpenSearch endpoint and appropriate index permissions. Confirm the target index/namespace with its owner before writing.

### 13.3 Catalog synchronization

To rebuild/synchronize branch product documents from PostgreSQL facts:

~~~sh
pnpm sync:postgres-products blr-01 mys-01
~~~

Use only approved store IDs, schema and OpenSearch index. The sync uses the same version-aware projection approach as the worker.

### 13.4 Local platform integration proof

A dedicated Compose setup is documented for isolated PostgreSQL and Kafka verification:

~~~sh
CKJS_LINKING=dynamic pnpm install --frozen-lockfile
docker compose -f infra/platform-test.compose.yml up --wait

docker compose -f infra/platform-test.compose.yml exec -T kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server 127.0.0.1:19093 --create \
  --topic commerce.events.platform-local.v1 --partitions 1 --replication-factor 1

pnpm test:platform
~~~

This test uses a dedicated local schema, topic and consumer group. It exercises the commerce commands, outbox relay and consumer path with a recording projection writer. It does not require a live OpenSearch index for that test.

Follow the cleanup command in docs/PLATFORM.md only for the Compose resources created by that run. Do not reset shared service state.

---

## 14. Testing and verification

Common checks:

~~~sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:shopping
~~~

Available focused commands:

| Command | Scope |
| --- | --- |
| pnpm test:unit | Unit tests |
| pnpm test:http | HTTP handler and adapter tests |
| pnpm test:security | Security boundary tests |
| pnpm test:browser | Browser/component behavior tests |
| pnpm test:shopping | Unit, HTTP, security and browser suites |
| pnpm test:contracts | Contracts and PostgreSQL product-facts reader tests |
| pnpm test:api | Product API tests against a running configured app |
| pnpm test:search | Discovery search tests |
| pnpm test:opensearch | OpenSearch projection tests |
| pnpm test:platform | Local PostgreSQL + Kafka platform integration |
| pnpm test:services | Service configuration/connectivity unit tests |
| pnpm test:india-demo | India demo data tests |
| pnpm test:ai | AI adapter and intent tests |
| pnpm test | HTTP smoke checks against a running application |

For pnpm test, set TEST_BASE_URL to target another running host:

~~~sh
TEST_BASE_URL=https://smart-tijori.onrender.com pnpm test
~~~

On PowerShell:

~~~powershell
$env:TEST_BASE_URL = "https://smart-tijori.onrender.com"
pnpm test
~~~

A passing unit or UI suite is not the same as a successful live-service integration run. Record which mode and dependencies were used when reporting verification.

---

## 15. Security and engineering rules

These rules are core to the architecture:

1. **PostgreSQL alone allocates stock.** Never allocate inventory in browser code, an API route, Kafka consumer, OpenSearch script or AI service.
2. **Commit business facts and outbox intent together.** Stock/order state and event intent belong in the same transaction.
3. **No external network calls inside stock-locking transactions.** Kafka, OpenSearch and AI are outside that critical section.
4. **The worker owns async delivery.** The worker publishes, consumes, schedules hold expiry and performs payment reconciliation. HTTP request handlers do not produce or consume Kafka.
5. **The consumer does not debit stock.** It reads current facts and updates the search projection.
6. **The projection writer is version guarded.** Older inventory versions must not overwrite newer documents.
7. **Resolve trusted actors at the server boundary.** Never take shopper/operator identity or operator branch authorization from an untrusted request body.
8. **Recheck ownership and state in commerce.** HTTP authorization is not a replacement for domain-level authorization.
9. **Use idempotency for write commands.** A repeated key with a different payload must be rejected.
10. **Keep fixtures explicit.** Fixture success must not masquerade as live service success.
11. **Keep secrets server-side.** No credentials in source control, logs, browser bundles or public environment variables.
12. **Use isolated namespaces for integration tests.** Do not reset shared/live state or create shared resources without explicit agreement.

These rules are also recorded in AGENTS.md.

---

## 16. Deployment

The documented hosted shopper prototype is deployed at https://smart-tijori.onrender.com.

The Render web service uses the pinned Node and pnpm versions, installs with CKJS_LINKING=dynamic, and starts through infra/run-render.mjs. The deployment launcher starts the Next.js app and projection worker under the hosted service lifecycle. On a free web instance, idle suspension affects both processes.

Hosted configuration uses private runtime environment values. The operator token and branch ID configure operator sign-in. OpenSearch catalog mode is enabled with ST_CATALOG_SOURCE=opensearch; the server hydrates search candidates with current PostgreSQL facts.

Do not enable demo mode on the hosted service. Payment live mode remains gated by ST_ENABLE_LIVE_PAYMENTS.

To smoke-check the hosted response:

~~~sh
TEST_BASE_URL=https://smart-tijori.onrender.com pnpm test
~~~

For an actual checkout/stock-conflict walkthrough, follow docs/SHOPPER_WEB.md. A successful page response alone is not proof of checkout, inventory concurrency or worker correctness.

---

## 17. Additional documentation

| Document | Read it for |
| --- | --- |
| docs/SHOPPER_WEB.md | Hosted shopper walkthrough, fixture mode, checkout conflict demo and deployment behavior |
| docs/PLATFORM.md | Commerce contracts, POS semantics, local PostgreSQL/Kafka proof, worker/event flow and projection rebuild |
| docs/SERVICES.md | Shared service setup, credentials, TLS, namespace rules, worker lifecycle and integration boundaries |
| docs/INDIA_DEMO_DATA.md | Synthetic India-wide demo seed and its explicit enablement |
| AGENTS.md | Module ownership, code boundaries, engineering invariants and development workflow |
| .env.example | Environment variable names and configuration comments |

---

## 18. Known boundaries and limitations

Keep these distinctions in mind when using or extending the project:

- **Fixture mode is not live commerce.** pnpm dev:shopping uses the documented in-memory fixture adapter; it is intended for shopper UI development.
- **The browser does not own inventory.** Any UI display is a view; the database command must re-check stock at reservation/sale time.
- **Search is eventually consistent.** A successful projection acknowledgment does not necessarily mean a document is already visible in search.
- **The event pipeline is at-least-once.** Design relay and consumer work to tolerate duplicates.
- **Operations diagnostics are recorded facts.** Timestamps and counters need interpretation; they do not prove instantaneous end-to-end search visibility.
- **Simulated payments are not real captures.** Live provider behavior requires approved credentials, webhook configuration and the explicit live-payment gate.
- **Live integration needs agreed resources.** PostgreSQL schema, Kafka topic/group and OpenSearch index must be explicitly scoped with the service owners.
- **A green build is not a live deployment test.** Build, isolated test fixtures, local platform integration and hosted live verification prove different things.

For the most accurate operational instructions, treat source code and automated checks as evidence of implementation, and use the focused docs for service-specific procedures.
