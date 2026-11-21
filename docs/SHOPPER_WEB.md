# Shopper prototype

The hosted prototype uses Aiven PostgreSQL for current prices and stock, carts,
reservations, orders and rules-based alternatives. Payments use Razorpay where configured; local fixture mode simulates payment. [Open the demo](https://smart-tijori.onrender.com).

## Walkthrough

1. Pick Bengaluru or Mysuru, add a product to your cart and proceed to checkout.
   Checkout reserves the items for five minutes. Confirm to see the simulated receipt.
2. To show a conflict, open the Bengaluru catalog in two separate browser
   profiles. In each profile, add one unit of an item that shows one available,
   such as Clear Day Front Load Liquid in the initial seed.
3. Open checkout in the first profile, then in the second within five minutes.
   Keep the first hold active. The second profile shows the conflict and suggests
   eligible in-stock products from the same branch. Approve a replacement to check
   out again. The first hold expires on its original deadline.

The catalog and alternatives show current stock when read. Checkout confirms
whether the requested quantity is still available. Saving restock interest records
demand. The operations workbench at `/ops` uses a branch-scoped cashier credential.
Open the POS terminal to submit a scanned code or paste a registered SKU. Inventory
and pipeline views show the current database facts for the signed-in branch.

## Local fixture mode

Run `pnpm dev:shopping` after the frozen install in the [README](../README.md).
Fixtures use an in-memory commerce adapter. This is useful for working on the
storefront without Aiven. Use the [platform verification](PLATFORM.md) for
authoritative PostgreSQL and Kafka checks.

## Hosted configuration and checks

The Render web service builds with the pinned Node and pnpm versions and
`CKJS_LINKING=dynamic`. The start command loads its private environment and
runs `infra/run-render.mjs` to launch Next.js and the projection worker. Both
processes follow the Free web instance's lifecycle, including idle suspension.
Merchant access requires a verified Firebase account with an active branch membership in `operator_memberships`.
The runtime uses private PostgreSQL connection settings and a trusted CA.
`ST_CATALOG_SOURCE=opensearch` enables typo-tolerant catalog search. Set private
`OPENSEARCH_*` credentials with read access to the selected index. Populate the
index from the same PostgreSQL schema using the [catalog sync](PLATFORM.md#configure-an-agreed-live-namespace).
Branch and category narrow the indexed candidates. The server then checks the
current PostgreSQL price and stock. Rules-based recovery still uses PostgreSQL.
`ST_CATALOG_SOURCE=postgres` selects literal catalog search. Leave
`SMARTTIJORI_DEMO_MODE` disabled on Render.

```sh
pnpm typecheck
pnpm lint
pnpm test:shopping
pnpm build
TEST_BASE_URL=https://smart-tijori.onrender.com pnpm test
```

The final smoke command verifies the deployed storefront response. Use the
walkthrough to verify checkout and recovery against the deployed database.

## Atelier integration

Run the app with the server environment documented in `.env.example` and apply
the PostgreSQL migrations to the target schema. Use a separate database schema,
Firebase test users, and Razorpay Test Mode for staging. Test payment rows stay
in staging.

- Firebase uses the `cents-lab-32d71` project. Register the SmartTijori web app,
  enable Email/Password and configure its authorized domains. Set the public
  web configuration at build time and use Application Default Credentials on
  the server. Keep the service account credential file outside the repository.
- Grant merchant access explicitly in `operator_memberships` using the verified
  Firebase UID and its branch ID. Set `active = false` to revoke branch access.
  Use a separate, random `SESSION_SECRET` per deployment. Legacy unsigned guest
  cookies are replaced once the secret is configured.
- Set the Razorpay key pair and a distinct webhook secret. Enable automatic
  capture and subscribe to `payment.captured` on `/api/payments/webhook`.
  Keep the worker running to reconcile captures and late-payment refunds.
  Leave `ST_ENABLE_LIVE_PAYMENTS` disabled for staging.
- Run `node --conditions=react-server --import tsx tests/platform.payments.mts`
  against the local platform Compose PostgreSQL service. The test creates its
  own schema and validates replay, amount matching and late capture.
