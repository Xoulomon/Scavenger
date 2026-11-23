# ADR-0002: Serve queries from an off-chain event-driven indexer

- **Status:** Accepted
- **Date:** Backfilled 2026-07-24; decision predates the ADR log
- **Deciders:** Core contributors
- **Related:** [ADR-0001](./0001-use-soroban-for-smart-contracts.md), [ADR-0005](./0005-indexer-relational-schema.md)

> Migrated from the inline ADR section of [ARCHITECTURE.md](../ARCHITECTURE.md), which
> is where this decision was originally recorded.

## Context

With state on-chain ([ADR-0001](./0001-use-soroban-for-smart-contracts.md)), the
product still needs to answer questions the ledger is bad at: "show this participant's
history", "aggregate weight by material type this month", "full-text search
participants".

Soroban storage is a key-value store with metered reads. There is no query planner, no
secondary index, and no aggregation. Answering those questions on-chain would mean
maintaining hand-rolled indexes in contract storage and paying to walk them on every
read.

## Decision

We will emit events from the contract for every state change, and run an off-chain
indexer (`indexer/`) that consumes them into Postgres. All read-heavy and analytical
queries are served from the indexer, not from the contract.

The contract remains the authority. The indexer is a derived, rebuildable projection.

## Alternatives Considered

| Alternative                                          | Why it was rejected                                                                                                                                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query the contract directly from the frontend        | Every non-trivial query becomes an on-chain iteration with metered reads. Aggregations and search are impractical.                                                                                                         |
| Maintain query-optimised indexes in contract storage | Shifts the cost to write time and inflates rent for data that does not need consensus. Some minimal indexes exist regardless (`PART_IDX`, `("participant_wastes", …)`), but they are enumeration aids, not a query engine. |
| Read directly from Horizon / RPC without an indexer  | No aggregation, no joins, no search, and no stable schema for external consumers.                                                                                                                                          |

## Consequences

### Positive

- Contract stays smaller and cheaper; query complexity lives where it is cheap.
- Full SQL: joins, aggregates, and Postgres full-text search (`search_vector` columns).
- Analytics and dashboards do not add on-chain cost.
- Because the indexer is derived, it can be rebuilt from `raw_events` after a handler
  bug fix — this is what `POST /replay` exists for.

### Negative

- **Eventual consistency.** A write confirmed on-chain is not immediately visible via
  the indexer. Clients that write and then read must account for the lag; `syncLag` on
  `GET /metrics` exposes it.
- Additional infrastructure to run and monitor: Postgres, the indexer process, alerting.
- Reorgs must be detected and handled rather than ignored.
- Two places can disagree. When they do, the chain wins and the indexer is rebuilt.

### Neutral

- Requires storing raw events durably so replay is possible — see
  [ADR-0005](./0005-indexer-relational-schema.md).
- The indexer's HTTP surface becomes a public API with its own compatibility
  obligations — see [`docs/API_REFERENCE.md`](../API_REFERENCE.md).

## Compliance

Any feature that adds an on-chain iteration purely to answer a read query contradicts
this ADR. The corresponding data should be projected into the indexer instead.
Derived indexer state must always be reconstructible from `raw_events`; a handler that
depends on data not present in the event stream breaks replay.
