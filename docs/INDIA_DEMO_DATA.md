# India-wide demonstration catalogue

**Synthetic retail fixtures, not verified merchants.** This dataset contains 47 fictional, clearly **Demo**-labelled stores in 43 real Indian cities and market neighbourhoods, and 41 example products. It covers larger metros, regional cities and smaller towns; small-scale grocers, fresh-produce stalls, markets, fishmongers, spice traders, bakeries, general stores and supermarkets. Classifying Indian cities into tiers is not globally standardized; this fixture does not claim an official tier classification.

Shop identity, stock counts, prices, barcode availability and willingness to participate are **invented for demonstrations**. They are neither official business-directory records nor live inventory. Never display synthetic rows as verified partner listings. Stock shown in the application is authoritative **within the chosen demonstration database only**. It makes no claim about a real shop's shelf.

## Why separate from the normal seed?

The normal `server/db/seed.sql` remains the small two-branch concurrency demonstration used by the engineering tests. This expanded dataset is strictly opt-in and never runs during migrations or application startup. It preserves existing store/product/inventory rows with `ON CONFLICT DO NOTHING`.

## Usage

Only use a purpose-built, explicitly approved `st_*` schema with migrations already applied. Configure the same TLS-secured PostgreSQL variables as in `.env.example`. Then run:

```sh
ST_ALLOW_INDIA_DEMO_SEED=true pnpm db:seed:india-demo --confirm-demo
```

The script checks the opt-in flag and command argument and inserts every row in one PostgreSQL transaction. Repeating it does not overwrite live inventory, prices, or existing catalog identifiers. It generates repeatable but **non-real** stock counts, including zero-stock and last-unit cases, suitable for conflict/recovery demonstrations.

A new shop selection updates the chosen `storeId`; product retrieval, cart, reservation, POS sale and availability still go through the existing server services. Merchant access is **not** granted to seeded stores. An administrator must separately register and verify a Firebase UID and grant the appropriate `operator_memberships` row for a particular branch.

## Production safety

Do not turn this on automatically in Render or any shared live schema. For public demonstrations, label all sample stores, products, inventory and payment receipts as demo fixtures. Real merchant onboarding needs retailer consent, verified coordinates/address, product assortments, current prices, reconciled inventory and explicit POS integrations. A checkout reservation is a logical allocation and does not prevent an unintegrated physical buyer from removing a product.

## Dataset conventions

- Stable prefixed `dm-*` store IDs and `demo-*` product IDs.
- Real cities/neighbourhood names, invented shop identities and inventory.
- Prices are illustrative **integer paise**; product quantities use grams, millilitres or count.
- Shop-type-specific stock allocation (e.g. fish sellers only fish/seafood and water; household sellers household products).
- Deterministic seeded stock quantities with zero and single-unit scenarios.
- No private information, no merchant credentials, no API keys.
