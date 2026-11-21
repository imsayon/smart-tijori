## Standalone shopper demo (explicitly simulated)

Run `pnpm dev:shopping` to start the Next.js shopper application with `SMARTTIJORI_DEMO_MODE=true`. Catalog, cart, 59-second reservation, simulated order and rules-only recovery route through the in-memory `FixtureCommerceAdapter`. This is **not** PostgreSQL allocation, integrated POS barcode enforcement, or AI inference. No payments or guaranteed restock notifications are performed.

`pnpm dev` does **not** activate fixture mode. Without an integrated authoritative commerce adapter and recovery implementation, live operations intentionally return errors rather than simulated success. The production `/api/products` path remains OpenSearch-based and requires authoritative facts. For independent tests use `pnpm test:shopping` and for the original service startup check use `pnpm test:services`.

---

> **Migration note (21 Nov 2026):** This web delivery report originally described the standalone `src/` checkout. The integration branch now places shopper app/components/contracts/fixtures under `client/` and HTTP adapters under `server/http/`. The root package scripts and environment follow the existing SmartTijori repository. Demo fixtures are not live stock allocation. Treat old `src/` paths and the original five-minute wording below as historical descriptions.

# SmartTijori — Srujan Web Application Module

> **Omnichannel Retail Web Application, Commerce HTTP Boundary, Sessions, Checkout UX, and Web Delivery**
>
> Built for the **Build Bengaluru Hackathon** · Team Ping Floyd
>
> Architecture baseline: `MASTER_PLAN.md` · Delivery plan: `THREE_FLOW_PLAN.md`

---

## 1. Module Overview & Ownership

This module represents **Srujan's** complete independent ownership track for SmartTijori:

- **Shopper Application Surface**: `src/app/(shop)/` and `src/components/shop/`
- **Commerce HTTP Boundary**: `src/server/http/` (Routes, Session Management, Security, Validation, Errors, Adapters)
- **Shared Design Tokens & Shell**: Forest green (`#173F35`), warm cream (`#F5F1E8`), lime action (`#84CC16`), amber/coral for expiry/conflicts.
- **Shopper Fixtures & Tests**: 24 curated pantry and household products across Bengaluru (`blr-01`) and Mysuru (`mys-01`) branches.
- **Web CI & Delivery Configuration**: `.github/workflows/web-ci.yml`, `.env.example`, Next.js 16 App Router build.

### Core Capabilities Implemented

| Capability | Promise to Shopper | Engineering Implementation |
|---|---|---|
| **ShelfSync** | Website and physical counter agree on available stock. | Web client and routes allocate against the same store/SKU inventory authority. Server-authoritative pricing and totals in paise. |
| **LastOne** | The final remaining unit cannot be promised to two buyers. | Real conflict detection. If stock runs out before checkout hold, atomic 409 `STOCK_UNAVAILABLE` is returned with `unavailableProducts`. |
| **CartLock** | Checkout provides an explicit, bounded opportunity to finish. | Server-issued 59-second atomic holds with countdown timer, server clock skew compensation, browser tab resume re-sync, and non-renewing holds on reload. |
| **ZeroDeadEnd** | Losing an item does not erase the shopping goal. | Untouched cart lines remain intact. Up to 3 verified in-stock replacements presented with factual comparison reasons (price difference, pack size, machine compatibility). Requires explicit shopper approval—never auto-substitutes. |

---

## 2. Directory Structure

```text
smart-tijori/
├── .github/
│   └── workflows/
│       └── web-ci.yml                 # Web CI: typecheck, lint, unit/http/security/browser tests, build
├── src/
│   ├── app/
│   │   ├── (shop)/
│   │   │   ├── page.tsx               # Storefront homepage (branch-aware catalog, search, filters)
│   │   │   ├── stores/page.tsx        # Branch selector (Bengaluru & Mysuru)
│   │   │   ├── search/page.tsx        # Search catalog with live query parameters
│   │   │   ├── products/[id]/page.tsx # Detailed product facts & ShelfSync guarantee
│   │   │   ├── cart/page.tsx          # Single-branch cart, quantity editing, removal
│   │   │   ├── checkout/page.tsx      # CartLock checkout state machine & payment simulation
│   │   │   ├── orders/[id]/page.tsx   # Order confirmation & simulated payment receipt
│   │   │   └── interest/page.tsx      # Stock interest registration when item unavailable
│   │   ├── api/
│   │   │   ├── stores/route.ts        # GET /api/stores
│   │   │   ├── products/route.ts      # GET /api/products
│   │   │   ├── cart/route.ts          # GET /api/cart, PUT /api/cart
│   │   │   ├── reservations/          # POST /api/reservations, GET/DELETE [id]
│   │   │   ├── orders/                # POST /api/orders, GET [id]
│   │   │   ├── interest/route.ts      # POST /api/interest
│   │   │   └── recovery/route.ts      # POST /api/recovery (ZeroDeadEnd factual candidate retrieval)
│   │   ├── layout.tsx                 # Root layout with StoreProvider & ShopperShell
│   │   └── globals.css                # Tailwind CSS v4 styling & color tokens
│   │
│   ├── components/
│   │   └── shop/
│   │       ├── layout/                # Header, Footer, ShopperShell
│   │       ├── navigation/            # BranchBanner with store indicator
│   │       ├── store-selector/        # StoreModal, BranchCard
│   │       ├── catalog/               # ProductGrid, SearchBar, FilterPanel
│   │       ├── product/               # ProductCard, ProductDetail, StockBadge
│   │       ├── cart/                  # CartView, CartLineItem, BranchSwitchDialog
│   │       ├── checkout/              # CheckoutView, HoldTimer, SimulatedPaymentReceipt
│   │       ├── reservation/           # HoldStatusCard
│   │       ├── recovery/              # ConflictRecoveryPanel, AlternativeCard, ConstraintEditor
│   │       └── feedback/              # Alert, LoadingSkeleton
│   │
│   ├── contracts/
│   │   └── index.ts                   # Canonical shared TypeScript types from MASTER_PLAN
│   │
│   ├── server/
│   │   └── http/
│   │       ├── auth/                  # Operator session guard (st_ops_session / Bearer token)
│   │       ├── sessions/              # Server-issued guest session manager (st_session HttpOnly cookie)
│   │       ├── validation/            # Zod request validation schemas
│   │       ├── security/              # CSRF mutation origin guard & 64KB bounded payload parser
│   │       ├── errors/                # HttpError mapping & safe error serialization
│   │       ├── adapters/              # CommerceCommands interface, RecordingAdapter, FixtureCommerceAdapter
│   │       └── routes/                # Reusable route handler functions
│   │
│   ├── lib/
│   │   ├── api-client/                # Typed fetch API client
│   │   ├── checkout/                  # OperationKeyManager, calculateHoldRemaining timer math
│   │   ├── session/                   # StoreContext React context provider
│   │   └── utils/                     # currency.ts (paise formatting), cn.ts
│   │
│   └── dev/
│       └── shopper-fixtures/          # 24 curated pantry and household products across blr-01 and mys-01
│
├── tests/
│   ├── fixtures/                      # Mock test data
│   ├── unit/                          # Session, currency, operation key, timer math tests
│   ├── http/                          # Stores, cart, reservations, orders, interest route tests
│   ├── security/                      # CSRF, operator guard, cross-session read/write denial, payload bounds
│   └── browser/                       # Accessibility, shopping flow, checkout conflict & recovery UX
│
├── vitest.config.ts                   # Vitest configuration with node & happy-dom environments
├── .env.example                       # Environment template
└── package.json
```

---

## 3. Working Features

1. **Responsive Shopper Application**:
   - Single-branch neighborhood storefront with Koramangala Bengaluru (`blr-01`) and Saraswathipuram Mysuru (`mys-01`).
   - Catalog filtering by category (`pantry`, `household`, `essentials`) and live search.
   - Accessible keyboard navigation, ARIA live announcements, visible focus states, contrast-compliant tokens.

2. **Branch-Aware Cart**:
   - Items added to cart do **not** lock stock.
   - Server-authoritative integer paise price and total calculation.
   - Switching branches prompts an explicit warning explaining that existing cart items and reservations will be reset.

3. **HTTP & Session Security Boundary**:
   - Server-issued guest identity stored in `st_session` HttpOnly, SameSite=Lax cookie.
   - Cross-session isolation: Session B cannot read or delete Session A's cart, hold, or order.
   - Mutation origin / CSRF verification on all `POST`, `PUT`, `DELETE` routes.
   - Payload size bounded to 64 KB to reject oversized JSON Denial of Service attempts.
   - Shared operator session guard (`st_ops_session` / Bearer token) rejecting untrusted body IDs.

4. **CartLock Checkout UX**:
   - Creates an all-or-nothing 59-second hold snapshot with `Idempotency-Key` header.
   - High-visibility countdown timer compensating for server clock skew.
   - Browser visibility change listener re-evaluating remaining seconds upon tab resume.
   - Page reload preserves remaining time from server clock; never extends the deadline.
   - Retry reuse: retrying the same intent reuses the operation key (recovering from lost responses); new cart edits generate a new key.

5. **ZeroDeadEnd Recovery UX**:
   - Triggers when a last unit is taken before checkout (`409 STOCK_UNAVAILABLE`).
   - Retains unaffected cart lines intact.
   - Fetches up to 3 candidate alternatives from the current branch.
   - Explains factual replacement reasons (e.g. `₹130 lower price`, `Identical pack size (1000 ml)`, `Matches front-load specification`).
   - Requires explicit shopper approval before cart update.
   - Stock interest capture if no candidate matches requirements.

6. **Order Receipt & Simulated Payment**:
   - Clearly labeled `SIMULATED PAYMENT — No actual charge occurred`.
   - Displays confirmed order ID, timestamp, lines, and store fulfillment details.

---

## 4. Independent Integration Seams (Waiting for Teammates)

Srujan's module defines clear, typed interfaces in `src/server/http/adapters/commerce-commands.ts` so Sayon and Shrinidhi can plug their production implementations in without rewriting HTTP routes:

### For Sayon (Commerce Core & PostgreSQL):
Implement `CommerceCommands` interface:
```typescript
export interface CommerceCommands {
  listStores(): Promise<Store[]>;
  getCart(sessionId: string): Promise<Cart>;
  updateCart(sessionId: string, storeId: string, lines: Array<{ productId: string; quantity: number }>): Promise<Cart>;
  createHold(sessionId: string, cartId: string, operationKey: string): Promise<CreateHoldResult>;
  getHold(sessionId: string, holdId: string): Promise<Hold | null>;
  releaseHold(sessionId: string, holdId: string): Promise<Hold | null>;
  confirmOrder(sessionId: string, reservationId: string, operationKey: string): Promise<Order>;
  getOrder(sessionId: string, orderId: string): Promise<Order | null>;
  saveInterest(sessionId: string, storeId: string, productId: string): Promise<StockInterest>;
  getProductOffers(storeId: string, params?: ProductFilterParams): Promise<ProductOffer[]>;
}
```
*To wire during merge:* Replace the adapter returned in `src/server/http/adapters/index.ts` with Sayon's PostgreSQL database commerce core. Note: The production PostgreSQL `createHold` implementation must enforce a 59-second hold duration (`now() + interval '59 seconds'`) matching `HOLD_DURATION_SECONDS = 59`.

### For Shrinidhi (Discovery & Recovery):
- Shrinidhi's recovery service plugs into `src/app/api/recovery/route.ts` or replaces `handlePostRecovery`.
- Shrinidhi's OpenSearch queries can plug into `GET /api/products` via `getProductOffers`.
- Shrinidhi can import our shared operator guard from `src/server/http/auth/operator-guard.ts` for all `/api/ops/*` routes.

---

## 5. Local Setup & Testing

### Prerequisites
- Node.js 20+
- pnpm 9+

### Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp .env.example .env.local

# 3. Run development server
pnpm dev
# Storefront opens at http://localhost:3000
```

### Running Test Suites
```bash
# Run all 57 automated tests
pnpm test

# Run unit tests (sessions, currency, operation keys, timer skew)
pnpm test:unit

# Run HTTP route handler tests (stores, cart, reservations, orders, interest)
pnpm test:http

# Run security tests (CSRF, operator guard, cross-session isolation, payload bounds)
pnpm test:security

# Run browser & accessibility tests (keyboard navigation, shopping flow, recovery UX)
pnpm test:browser

# Run TypeScript typecheck
pnpm typecheck

# Run ESLint
pnpm lint
```

### Production Build
```bash
pnpm build
pnpm start
```
*Note: The production build is fully self-contained and does NOT require live PostgreSQL, Kafka, or OpenSearch credentials.*

---

## 6. Files Requiring Coordination Before Merging
- `package.json` & `pnpm-lock.yaml`: Coordinate any new root packages with Sayon.
- `src/contracts/index.ts`: Source of truth for shared DTOs; coordinate any field extensions.
- `src/server/http/adapters/index.ts`: Wire Sayon's transactional PostgreSQL adapter.
