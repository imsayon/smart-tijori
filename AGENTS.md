# SmartTijori engineering rules

One pnpm package with a Next.js storefront and a Node worker at `server/worker.ts`.
The plans describe intended behavior. Source and checks establish implemented
behavior. Current tasks and status belong in Linear.

## Module ownership

- Commerce/platform: `server/commerce`, `server/events`, `server/worker.ts`,
  `server/db/`, platform tests/fixtures and final composition.
- Web: `client/app/(shop)`, `client/components/shop`, root layout/styles,
  `server/http`, stores/cart/reservations/orders/interest API routes,
  web verification, CI and delivery.
- Discovery/operations: `server/discovery`, `server/operations`,
  `client/app/ops`, `client/components/ops`, products/recovery/ops API routes,
  search/evaluation/diagnostics and related tests/fixtures.
- Coordinate changes to `server/contracts`, root dependencies/lockfile and shared
  configuration with the affected module owners. Update their callers/checks.

## Engineering boundaries

- Read the relevant code and plans before editing. Preserve others' changes;
  keep changes scoped and prefer existing patterns over new abstractions.
- PostgreSQL alone allocates stock. Domain changes and outbox intent commit in
  one transaction. Never call Kafka, search or a model while holding stock locks.
- The worker owns publication, consumption, expiry scheduling and acknowledgment.
  Discovery owns the version-guarded projection writer. Consumers never debit stock.
- HTTP adapters resolve trusted actors and validate input; commerce independently
  enforces ownership/state. Reuse shared session/permission helpers.
- Keep credentials/clients in server modules. No live connections at import/build
  time, secrets in `NEXT_PUBLIC_*`, certificate-verification bypasses, or secrets in logs.
- Fixtures are explicit development/test inputs. Live dependency failures must
  stay visible. Do not add mock success routes or empty service scaffolding.
- Use isolated disposable namespaces for integration work. Provisioning and
  destructive reset require explicit scope; never reset shared/live state.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm build` and relevant tests. The current
  `pnpm test` smoke check needs a running application; see README. Review the diff
  for unnecessary code and secrets before handoff.
- Keep private discussions, workload negotiations and private KB paths out of
  source documentation. Keep architecture person-neutral and execution in Linear.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
