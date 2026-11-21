# SmartTijori

A neighborhood retail prototype with a Next.js storefront, PostgreSQL stock
allocation and a Kafka outbox worker. [Open the hosted demo](https://smart-tijori.onrender.com).

## Run locally

Use the Node version in `.nvmrc` and pnpm 12.21.0.

```sh
nvm use
pnpm install --frozen-lockfile
pnpm dev:shopping
```

[Open localhost:3000](http://localhost:3000). This command explicitly enables
local shopper fixtures and works without service credentials after installation.

```sh
pnpm typecheck
pnpm lint
pnpm test:shopping
pnpm build
```

Run `pnpm test` against a running app. Set `TEST_BASE_URL` to check another host.

## Repository map

| Location | Responsibility |
| --- | --- |
| `client/` | Next.js storefront and API route entry points |
| `server/http/` | Request validation, sessions and adapter composition |
| `server/commerce/`, `server/db/` | Stock, reservations, orders, migrations and scoped demo seeds |
| `server/events/`, `server/worker.ts` | Kafka outbox and consumer |
| `server/discovery/` | OpenSearch indexing and retrieval |
| `infra/`, `tests/` | Local service definitions and verification |

- [Shopper demo and deployment](docs/SHOPPER_WEB.md)
- [Commerce and Kafka verification](docs/PLATFORM.md)
- [Private service configuration](docs/SERVICES.md)
- [Engineering rules](AGENTS.md) and the [Linear shared KB](https://linear.app/msayon/document/smarttijori-shared-kb-start-here-20ae5a755fbf)
