# ADR-0010: Cache frontend data in React Query with IndexedDB persistence, plus a Workbox service worker

- **Status:** Accepted
- **Date:** 2026-10-16 (decision recorded from [CACHING_STRATEGY.md](../CACHING_STRATEGY.md); the strategy predates this ADR)
- **Deciders:** Frontend maintainers
- **Related:** [ADR-0002](./0002-off-chain-event-driven-indexing.md), [ADR-0006](./0006-wallet-based-authentication-flow.md)

---

## Context

Most frontend reads are aggregates or participant data served by the backend and indexer. Many pages are opened repeatedly by users on unreliable mobile connections, and Stellar transactions can take seconds to appear in indexed reads. Re-fetching everything on each navigation was slow, and dropped connections left screens empty.

## Decision

We will cache frontend data in three layers:

1. **React Query** holds in-memory results with per-data-type stale times (for example 30s for waste items, 2min for global metrics, 5min for incentives). `persistQueryClient` writes them to IndexedDB with a 24h `gcTime`.
2. **A Workbox service worker** caches static assets and API responses that can be served stale.
3. **Stable cache keys** are defined per hook, so invalidation after a transaction targets specific data.

## Alternatives Considered

| Alternative | Why it was rejected |
|-------------|---------------------|
| Redux or a hand-written store for server data | Duplicates staleness and refetch logic that React Query already provides. |
| `localStorage` persistence | Synchronous and size-limited; too small for cached aggregates. |
| Service worker only | Cannot invalidate per-query after a wallet transaction, so users see stale balances. |

## Consequences

### Positive

- Repeat visits and offline reads render from cache.
- Stale times are declared next to the hook that uses them.

### Negative

- Users can see data up to the stale time old after a transaction, so write paths must invalidate the affected keys.
- IndexedDB persistence means cache schema changes need a version bump to avoid reading old shapes.

### Neutral

- Redis caching on the backend is a separate concern and is documented in [CACHING_STRATEGY.md](../CACHING_STRATEGY.md) and [ARCHITECTURE.md](../ARCHITECTURE.md).

## Compliance

- Stale times and persistence are configured in `frontend/src/main.tsx`. Changing them without updating the table in [CACHING_STRATEGY.md](../CACHING_STRATEGY.md) does not comply.
