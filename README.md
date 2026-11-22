# SmartTijori

SmartTijori is a high-reliability neighborhood retail commerce engine and omni-channel storefront. It unifies high-concurrency online grocery shopping with in-store physical POS terminals using **PostgreSQL as the single source of truth for stock allocation**, a **transactional Kafka outbox pipeline**, and an **eventually consistent OpenSearch catalog projection**.

Live Demo: [https://smart-tijori.onrender.com](https://smart-tijori.onrender.com)

---

## Table of Contents

- [Architectural Principles & Invariants](#architectural-principles--invariants)
- [System Architecture & Data Flow](#system-architecture--data-flow)
- [Core Workstreams & Capabilities](#core-workstreams--capabilities)
  - [1. Shopper Storefront & Conflict Recovery](#1-shopper-storefront--conflict-recovery)
  - [2. Physical POS Cashier Terminal](#2-physical-pos-cashier-terminal)
  - [3. Store Inventory Monitoring](#3-store-inventory-monitoring)
  - [4. Event Pipeline & Telemetry Diagnostics](#4-event-pipeline--telemetry-diagnostics)
- [Technology Stack](#technology-stack)
- [Repository Map](#repository-map)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Zero-Dependency Shopper Mode (Quick Start)](#zero-dependency-shopper-mode-quick-start)
  - [Full Local Platform Mode (Docker Compose)](#full-local-platform-mode-docker-compose)
  - [Live Services Mode (Aiven Managed Stack)](#live-services-mode-aiven-managed-stack)
- [Environment Configuration](#environment-configuration)
- [Available Scripts Reference](#available-scripts-reference)
- [Interactive Verification Scenarios](#interactive-verification-scenarios)
  - [Scenario A: Multi-Shopper 59s Hold Conflict & Alternative Recovery](#scenario-a-multi-shopper-59s-hold-conflict--alternative-recovery)
  - [Scenario B: POS Barcode Checkout vs. Online Reservation Conflict](#scenario-b-pos-barcode-checkout-vs-online-reservation-conflict)
- [Security & Operational Invariants](#security--operational-invariants)

---

## Architectural Principles & Invariants

SmartTijori is built around strict data consistency and fault-isolation rules:

1. **PostgreSQL Single-Stock Authority**:
   - Only PostgreSQL allocates, reserves, debits, or restores stock.
   - Domain operations (holds, sales, cancellations) and outbox event intent commit within the **same atomic ACID transaction**.
   - **No external network calls** (Kafka, OpenSearch, AI models, third-party APIs) are ever executed while holding row-level stock locks.
2. **Transactional Outbox & At-Least-Once Delivery**:
   - Event publication is decoupled from HTTP request lifecycles.
   - The worker relay claims outbox events in PostgreSQL and publishes them to Apache Kafka, updating publication status only upon receiving broker acknowledgment.
3. **Monotonic Version-Guarded Projections**:
   - The Kafka projection consumer updates OpenSearch using monotonic `inventoryVersion` checks.
   - Stale or out-of-order events are safely ignored; newer writes are never overwritten by lagging consumer offsets.
   - The consumer **never** debits or mutates inventory stock.
4. **Poison-Pill Quarantine**:
   - Malformed or unrecoverable events are durably recorded to a quarantine table in PostgreSQL rather than blocking partition consumer offsets.
5. **Idempotency & Replay Safety**:
   - POS sales and shopper orders enforce client/operator idempotency keys with payload hashing.
   - Retries with identical keys return the first committed outcome and original timestamps.

---

## System Architecture & Data Flow

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                              CLIENT LAYER                              │
 │   Online Shopper Web (Next.js)      │      In-Store POS Terminal       │
 └───────────────────┬─────────────────┴────────────────────┬─────────────┘
                     │                                      │
                     ▼                                      ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         HTTP & ADAPTER LAYER                           │
 │   Next.js App Router API Routes (/api/*) & Session Authorizers         │
 │   - Shopper Session & CSRF Guards   │  - Operator Guard (Role + Store) │
 └───────────────────┬─────────────────┴────────────────────┬─────────────┘
                     │                                      │
                     ▼                                      ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         COMMERCE DOMAIN ENGINE                         │
 │   - 59s Reservation Holds           │  - Single-SKU POS Sales          │
 │   - Cart Line Bounds & Totals       │  - Idempotency & Stock Debits    │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                     Single Atomic ACID Transaction
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      POSTGRESQL (Source of Truth)                      │
 │   - Inventory (Stock on Hand, Holds, Versions, Movements)              │
 │   - Reservations, Carts, Orders, Restock Demand                        │
 │   - Outbox Event Ledger & Idempotency Logs                             │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                      Polled by Transactional Relay
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                          APACHE KAFKA TOPIC                            │
 │   commerce.events.* (Partitioned Event Stream, mTLS / SASL_SSL)        │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                             Consumed by Worker
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      SEARCH & PROJECTION WORKER                        │
 │   - Version-Guarded Projection Writer (Monotonic inventoryVersion)     │
 │   - Poison Pill Quarantine Isolation                                   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      OPENSEARCH CATALOG INDEX                          │
 │   Typo-tolerant discovery candidates (hydrated from PostgreSQL facts)  │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## Core Workstreams & Capabilities

### 1. Shopper Storefront & Conflict Recovery
- **Hyperlocal Branch Catalog**: Switch branches (e.g., Bengaluru `blr-01`, Mysuru `mys-01`) with live stock and pricing.
- **59-Second Reservation Holds**: Adding items to checkout places a temporary hold on stock for exactly 59 seconds.
- **Urgency Countdown (`HoldTimer`)**: Live countdown displaying visual urgency thresholds (<60s warning, <30s critical) with accessible ARIA announcements and an audible warning tone (via Web Audio API).
- **Conflict Resolution Engine**: When checkout fails due to a concurrent stock lock, the UI surfaces eligible, in-stock alternatives from the same branch based on price, category, and constraint satisfaction.
- **Restock Demand Capture**: Allows shoppers to register purchase interest on out-of-stock SKUs to gauge restocking demand.

### 2. Physical POS Cashier Terminal
- **Mounted Route**: `/ops/pos`
- **Rapid Barcode Scanning**: Accepts hardware USB/Bluetooth barcode scanner inputs (with automatic whitespace and terminator stripping) or manual SKU entry.
- **Instant Stock Debits**: Bypasses the 59s online hold queue to execute immediate in-store sales against available PostgreSQL stock.
- **Stock Lock Detection**: If stock is held by online shoppers but available on the shelf, returns an explicit `STOCK_LOCKED_ONLINE` status code.
- **Operator Idempotency**: Guards against accidental double-scanning via operator-scoped idempotency keys.

### 3. Store Inventory Monitoring
- **Mounted Route**: `/ops/inventory`
- **Read-Only Fact Pipeline**: Powered by `GET /api/ops/inventory` delegating to `createCommerceFacts(db).readOpsFacts(storeId)`.
- **Per-SKU Stock Table**: Displays stock-on-hand, online holds, net available units, version numbers, and out-of-stock badges.
- **Stock Movement Ledger**: Full audit trail recording delta adjustments, checkout debits, hold allocations, manual restocks, and sales receipts.

### 4. Event Pipeline & Telemetry Diagnostics
- **Mounted Route**: `/ops/diagnostics`
- **Telemetry API**: Powered by `GET /api/ops/diagnostics` delegating to `createPipelineReader(db)(storeId)`.
- **Worker Health Metrics**: Outbox pending event count, oldest pending event lag, last Kafka broker acknowledgment timestamp, last projection acceptance timestamp, retry attempts, and partition status.
- **Poison-Pill Quarantine Log**: Tracks quarantined invalid events with error stacks and payload keys without blocking the consumer pipeline.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Storefront & UI** | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, Lucide Icons |
| **Language & Tooling** | TypeScript 6, Node.js (v26.13.1 pinned in `.nvmrc`), pnpm 12.21.0 |
| **Relational Database** | PostgreSQL 17 (via `pg` with connection pooling, advisory locks, and SSL/mTLS) |
| **Messaging & Streaming** | Apache Kafka 4.3.2 (via `@confluentinc/kafka-javascript` with mTLS/SASL) |
| **Search Engine** | OpenSearch 3.10 (via `@opensearch-project/opensearch` with external versioning) |
| **Testing & Verification** | Vitest 5, Testing Library React, Happy-DOM, MSW, Playwright |

---

## Repository Map

```text
├── client/                               # Next.js App Router Frontend
│   ├── app/
│   │   ├── (shop)/                       # Shopper storefront routes (/, /cart, /checkout, /stores, /interest)
│   │   ├── ops/                          # Operations workbench (/ops, /ops/pos, /ops/inventory, /ops/diagnostics)
│   │   └── api/                          # Next.js HTTP API route handlers
│   │       ├── ops/                      # Read-only inventory and pipeline diagnostic endpoints
│   │       ├── pos/                      # POS barcode cashier checkout endpoint
│   │       ├── reservations/             # Shopper 59s hold reservation endpoints
│   │       ├── orders/                   # Order placement & simulated payment
│   │       ├── recovery/                 # Cart conflict recovery alternatives
│   │       └── products/                 # Product catalog search (OpenSearch / PostgreSQL)
│   ├── components/                       # Reusable UI component libraries
│   │   ├── shop/                         # Shopper storefront components (checkout, hold timer, recovery)
│   │   └── ops/                          # Workbench components (overview, POS panel, inventory, diagnostics)
│   └── lib/                              # Client utilities, API clients, and barcode parsers
│
├── server/                               # Core Backend & Business Domain Modules
│   ├── commerce/                         # Stock allocation, reservation holds, POS sales, facts reader
│   ├── events/                           # Transactional outbox relay, Kafka producer/consumer, diagnostics
│   ├── discovery/                        # OpenSearch search service, sync script, versioned writer
│   ├── db/                               # PostgreSQL database client, migrations, and demo seeds
│   ├── http/                             # HTTP route adapters, session guards, and CSRF protection
│   └── worker.ts                         # Standalone background worker (outbox relay & projection consumer)
│
├── infra/                                # Infrastructure Scripts & Container Definitions
│   ├── platform-test.compose.yml         # Local Docker Compose for PostgreSQL & Kafka
│   ├── run-render.mjs                    # Production supervisor for Render deployment
│   ├── setup-index.ts                    # OpenSearch index schema initialization
│   ├── sync-postgres-products.ts         # Direct PostgreSQL-to-OpenSearch catalog sync
│   └── seed-opensearch.ts                # OpenSearch standalone seed script
│
├── tests/                                # Multi-Tier Verification Suite
│   ├── browser/                          # Component and browser interaction tests (Vitest + Happy-DOM)
│   ├── http/                             # HTTP endpoint integration and route handler tests
│   ├── unit/                             # Pure business logic, timers, and contract tests
│   ├── security/                         # Operator session guards, CSRF, and payload bounds tests
│   └── platform.integration.mjs          # End-to-end PostgreSQL + Kafka integration suite
│
└── docs/                                 # Detailed Architecture & Operational Runbooks
    ├── SHOPPER_WEB.md                    # Storefront walkthrough, demo flows, and Render setup
    ├── PLATFORM.md                       # Commerce contracts, Kafka verification, and migration runbooks
    └── SERVICES.md                       # Managed service connections, TLS certificates, and secrets runbooks
```

---

## Getting Started

### Prerequisites

- **Node.js**: `26.13.1` (configured via `.nvmrc`)
- **pnpm**: `12.21.0`
- **Dynamic Linking**: Required for native Kafka client compilation:
  ```sh
  export CKJS_LINKING=dynamic   # Linux / macOS
  $env:CKJS_LINKING="dynamic"   # Windows PowerShell
  ```

---

### Zero-Dependency Shopper Mode (Quick Start)

You can launch and explore the complete shopper storefront, cart, hold countdown, and conflict recovery UX immediately without running PostgreSQL, Kafka, or OpenSearch:

```sh
# 1. Install pinned dependencies
CKJS_LINKING=dynamic pnpm install --frozen-lockfile

# 2. Launch storefront in demo fixture mode
pnpm dev:shopping
```

Open [http://localhost:3000](http://localhost:3000) in your browser. This mode uses deterministic in-memory fixtures.

---

### Full Local Platform Mode (Docker Compose)

To run against real local PostgreSQL and Apache Kafka instances:

```sh
# 1. Start PostgreSQL and Kafka containers
docker compose -f infra/platform-test.compose.yml up --wait

# 2. Create the local Kafka topic
docker compose -f infra/platform-test.compose.yml exec -T kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server 127.0.0.1:19093 --create \
  --topic commerce.events.platform-local.v1 --partitions 1 --replication-factor 1

# 3. Run the automated platform integration test
pnpm test:platform

# 4. Start Next.js connected to the local database
pnpm dev
```

To tear down local containers and volumes:
```sh
docker compose -f infra/platform-test.compose.yml down --volumes
```

---

### Live Services Mode (Aiven Managed Stack)

For cloud deployment or testing against managed Aiven PostgreSQL, Kafka, and OpenSearch clusters:

1. Copy `.env.example` to `client/.env.local`.
2. Configure credentials and TLS certificate paths:
   ```sh
   # Verify connection to PostgreSQL, Kafka, and OpenSearch
   pnpm check:services
   ```
3. Run database migrations:
   ```sh
   pnpm db:migrate
   ```
4. Start the projection worker and storefront:
   ```sh
   pnpm worker &
   pnpm dev
   ```

---

## Environment Configuration

Configuration variables are read from `client/.env.local` or host environment variables:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URI | `postgres://user:pass@host:port/dbname` |
| `DATABASE_CA_CERT_PATH` | Path to PostgreSQL CA certificate | `secrets/ca.pem` |
| `ST_DB_SCHEMA` | Active PostgreSQL schema namespace | `public` / `st_platform_verify_v1` |
| `KAFKA_BROKERS` | Comma-separated Kafka broker addresses | `host:port` |
| `KAFKA_SECURITY_PROTOCOL` | Kafka connection protocol | `SSL` (mTLS) or `SASL_SSL` |
| `KAFKA_CA_CERT_PATH` | Path to Kafka CA certificate | `secrets/ca.pem` |
| `KAFKA_CLIENT_CERT_PATH` | Path to Kafka client certificate (for mTLS) | `secrets/service.cert` |
| `KAFKA_CLIENT_KEY_PATH` | Path to Kafka client private key (for mTLS) | `secrets/service.key` |
| `KAFKA_TOPIC` | Outbox topic name | `commerce.events.v1` |
| `KAFKA_GROUP_ID` | Consumer group ID | `smart-tijori-projector-v1` |
| `OPENSEARCH_URL` | HTTPS endpoint for OpenSearch | `https://search-host:port` |
| `OPENSEARCH_USERNAME` | OpenSearch service username | `admin` |
| `OPENSEARCH_PASSWORD` | OpenSearch service password | `********` |
| `OPENSEARCH_INDEX` | Catalog search index name | `products` |
| `ST_CATALOG_SOURCE` | Catalog backend provider | `opensearch` or `postgres` |
| `ST_OPS_OPERATOR_TOKEN` | Secret token for `/ops` operator session | `operator-secret-token` |
| `ST_OPS_STORE_ID` | Default store ID authorized for the operator | `blr-01` |
| `SMARTTIJORI_DEMO_MODE` | Enable synthetic in-memory demo fixtures | `true` or `false` |

---

## Available Scripts Reference

| Command | Action |
| :--- | :--- |
| `pnpm dev:shopping` | Starts the Next.js dev server in zero-dependency demo mode (`localhost:3000`) |
| `pnpm dev` | Starts Next.js in standard mode connecting to configured services |
| `pnpm build` | Compiles optimized Next.js production build using Turbopack |
| `pnpm start` | Launches the production server |
| `pnpm lint` | Runs ESLint across the codebase with `--max-warnings=0` |
| `pnpm typecheck` | Generates Next.js route types and executes `tsc --noEmit` |
| `pnpm test:shopping` | Runs the full Vitest suite (unit, HTTP, browser, and security tests) |
| `pnpm test:unit` | Runs pure unit and business logic tests |
| `pnpm test:http` | Runs HTTP route adapter and session security tests |
| `pnpm test:security` | Runs operator session guard, CSRF, and bounds tests |
| `pnpm test:browser` | Runs Happy-DOM browser component tests |
| `pnpm test:platform` | Runs end-to-end PostgreSQL + Kafka integration suite |
| `pnpm check:services` | Performs connection check across PostgreSQL, Kafka, and OpenSearch |
| `pnpm db:migrate` | Applies ordered PostgreSQL migrations under advisory lock |
| `pnpm worker` | Starts the transactional outbox publisher and Kafka projection worker |
| `pnpm sync:postgres-products` | Rebuilds OpenSearch catalog index from current PostgreSQL facts |

---

## Interactive Verification Scenarios

### Scenario A: Multi-Shopper 59s Hold Conflict & Alternative Recovery

This walkthrough demonstrates PostgreSQL stock reservation safety and rule-based recovery:

1. Open `http://localhost:3000` in two separate browser profiles (or an Incognito window).
2. In both sessions, select the **Bengaluru (`blr-01`)** branch and locate a product with only `1` unit available in stock (e.g., *Clear Day Front Load Liquid*).
3. In **Browser 1**, click **Add to Cart**, navigate to `/cart`, and proceed to `/checkout`.
   - Browser 1 immediately obtains a **59-second hold**. The countdown timer begins ticking, displaying the visual countdown and auditory safety indicators.
4. Within that 59-second window, attempt to check out the same product in **Browser 2**.
5. **Result**: Browser 2's reservation attempt fails due to stock exhaustion. The application transitions to the **Conflict Recovery Panel**, presenting eligible in-stock alternatives from the same store.
6. Once the 59-second hold in Browser 1 expires (or is confirmed), Browser 2 can re-reserve the item or accept an approved replacement.

---

### Scenario B: POS Barcode Checkout vs. Online Reservation Conflict

This walkthrough demonstrates physical in-store cashier priority over online cart holds:

1. In a browser session, reserve the last remaining unit of an item online via the storefront.
2. Sign into the Operations Workbench at `http://localhost:3000/ops` and navigate to the **POS Terminal** (`/ops/pos`).
3. Scan or enter the barcode for the reserved SKU (demonstration barcodes use the format `ST:<product-id>`).
4. **Result**:
   - The POS terminal detects the stock conflict and surfaces `STOCK_LOCKED_ONLINE`.
   - The cashier is notified that the physical unit on the shelf is currently held by an unconfirmed online cart hold.
   - When the online hold expires at 59 seconds, scanning the barcode again immediately finalizes the sale, debits PostgreSQL stock, logs the movement, and prints the receipt.

---

## Security & Operational Invariants

- **Zero Secrets in Git / Bundles**: No credentials or private certificates exist in source control, client bundles, or `NEXT_PUBLIC_*` environment variables.
- **Strict Role-Based Operator Guard**: `/ops` and its underlying APIs require authenticated operator sessions with store-level authorization checks. Requests attempting cross-store data access receive an immediate `403 Forbidden` ApiError.
- **Payload Bounding**: All incoming HTTP payloads are strictly validated using Zod schemas with finite array length, string length, and numeric quantity limits.
- **CSRF Protection**: State-changing POST/PUT/DELETE operations validate custom HTTP headers and cookie origins.

---

## License

Private repository. All rights reserved.
