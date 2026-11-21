# Shopper prototype

The hosted prototype uses Aiven PostgreSQL for its catalog, cart, reservations,
orders and rules-based alternatives. Payments are simulated. [Open the demo](https://smart-tijori.onrender.com).

## Walkthrough

1. Pick Bengaluru or Mysuru, add a product to your cart and proceed to checkout.
   Checkout reserves the items for 59 seconds. Confirm to see the simulated receipt.
2. To show a conflict, open the Bengaluru catalog in two separate browser
   profiles. In each profile, add one unit of an item that shows one available,
   such as Clear Day Front Load Liquid in the initial seed.
3. Open checkout in the first profile, then in the second within 59 seconds.
   Keep the first hold active. The second profile shows the conflict and suggests
   eligible in-stock products from the same branch. Approve a replacement to check
   out again. The first hold expires on its original deadline.

The catalog and alternatives show current stock when read. Checkout confirms
whether the requested quantity is still available. Saving restock interest records
demand. The protected cashier route, scanner UI and OpenSearch composition are
tracked separately.

## Local fixture mode

Run `pnpm dev:shopping` after the frozen install in the [README](../README.md).
Fixtures use an in-memory commerce adapter. This is useful for working on the
storefront without Aiven. Use the [platform verification](PLATFORM.md) for
authoritative PostgreSQL and Kafka checks.

## Hosted configuration and checks

The Render web service builds the repository root with the pinned Node and pnpm
versions. The start command runs the Next app in `client/` on Render's port.
The runtime uses private PostgreSQL connection settings and a trusted CA.
`ST_CATALOG_SOURCE=postgres` explicitly selects the PostgreSQL catalog and
rules-based recovery. Leave `SMARTTIJORI_DEMO_MODE` disabled for that deployment.

```sh
pnpm typecheck
pnpm lint
pnpm test:shopping
pnpm build
TEST_BASE_URL=https://smart-tijori.onrender.com pnpm test
```

The final smoke command verifies the deployed storefront response. Use the
walkthrough to verify checkout and recovery against the deployed database.
