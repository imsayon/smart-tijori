# SmartTijori

One TypeScript/Next.js application and one Node worker. The app serves a startup
page. The commerce platform provides shared contracts, PostgreSQL commands and
facts, an outbox relay, and a Kafka consumer with an injected projection writer.

## Setup and commands

Use [nvm](https://github.com/nvm-sh/nvm) or install the exact Node version in
`.nvmrc` with your preferred version manager:

```sh
nvm install
nvm use
npm install --global pnpm@12.21.0
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. No `.env` file, service account or internet connection
is needed to run the installed application. Installing packages needs registry
access. `pnpm-workspace.yaml` holds pnpm 12 settings; this remains a single package.

```sh
pnpm typecheck                  # Generate Next route types, then strict tsc
pnpm lint                       # Next/TypeScript rules; warnings fail
pnpm build                      # Production build, without service connections
pnpm start                      # Serve the production build
```

With `pnpm start` running in another terminal, run `pnpm test`. This uses Node's
built-in test runner to request the startup page and check its response/markup.
For a different port, use
`TEST_BASE_URL=http://127.0.0.1:3001 pnpm test`.

Runtime/package pins: Node 24.22.3, pnpm 12.21.0, Next.js/eslint-config-next
16.4.6, React 19.3.1, TypeScript 6.0.3 and ESLint 9.39.5. All direct dependencies
and the lockfile are pinned. Node 24 follows the design baseline and remains LTS.
[Next's requirements](https://nextjs.org/docs/app/getting-started/installation)
permit this runtime. TypeScript 6 fits the
[lint parser's supported range](https://typescript-eslint.io/users/dependency-versions/);
TypeScript 7 currently does not. ESLint 9 fits Next's React/import/accessibility
plugin peers; upstream marks it deprecated, so revisit it when those peers support
ESLint 10. Versions were checked against official docs and npm package metadata on
17 November 2026.

## Source boundaries

The repository uses four source roots and one package. Create planned submodules
when their first real implementation is ready.

| Location | Responsibility |
| --- | --- |
| `client/app/`, `client/components/` | Next routes, shopper/operator UI and thin server-executed API entry points |
| `server/connections.ts` | Lazy PostgreSQL, Kafka and OpenSearch client factories |
| `server/check-services.mjs` | Authenticated, read-only connectivity check |
| `server/commerce/`, `server/db/` | Stock transactions, current facts, migrations and seeds |
| `server/events/`, `server/worker.ts` | Outbox delivery, consumption and expiry scheduling |
| `server/http/` | Planned shared sessions, permissions, validation and HTTP handlers |
| `server/discovery/`, `server/operations/` | Planned search, projection writer and operations behavior |
| `server/contracts/` | Browser-safe DTOs and small module interfaces |
| `ai/` | Planned model providers, intent extraction and evaluations |
| `infra/` | Deployment/container configuration when needed |
| `tests/` | Platform, service configuration and running-app checks |

The web track owns shopper routes, shared HTTP/security helpers and web delivery.
The commerce/platform track owns database/events/worker and system composition.
The discovery/operations track owns search/recovery APIs, the writer and workbench.
Coordinate shared contracts, dependencies and root configuration across affected
modules. Detailed rules are in [AGENTS.md](AGENTS.md).

## Environment and services

The startup page and build do not connect to services. For live checks, copy
`.env.example` to **`client/.env.local`** and fill values privately from Aiven.
Never overwrite an existing private environment file. Store certificates and keys
under ignored `secrets/`; set certificate paths for your own checkout. Next loads
`client/.env.local`; the standalone check explicitly loads that same file.

```sh
pnpm test:services               # Offline configuration/TLS guard tests
pnpm check:services              # Live SELECT 1, Kafka metadata and OpenSearch info
```

On 21 November 2026 all three authenticated, TLS-verified read checks passed from
the setup machine. PostgreSQL and Kafka run in Aiven project `smart-tijori`, Free
plans in Bangalore (`do-blr`). OpenSearch remains in its owner's separate project.
This proves connectivity, not stock allocation, event delivery or search freshness.
No application tables, Kafka topic or search index were created by these checks.

Read [service setup and lifecycle](docs/SERVICES.md) for teammate setup and
[commerce and event platform](docs/PLATFORM.md) for the local proof,
migrations, adapter contract and worker commands. Shared plans,
current handoff prompts and access status are in the
[Linear shared KB](https://linear.app/msayon/document/smarttijori-shared-kb-start-here-20ae5a755fbf).
Linear documents and source files do not automatically synchronize.
