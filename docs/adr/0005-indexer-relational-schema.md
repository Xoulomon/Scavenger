# ADR-0005: Project events into a normalised Postgres schema, keeping raw events

- **Status:** Accepted
- **Date:** Backfilled 2026-07-24; decision predates the ADR log
- **Deciders:** Core contributors
- **Related:** [ADR-0002](./0002-off-chain-event-driven-indexing.md); `indexer/src/db/migrations/`; [`docs/API_REFERENCE.md`](../API_REFERENCE.md)

## Context

[ADR-0002](./0002-off-chain-event-driven-indexing.md) commits to serving queries from
an off-chain projection of the contract's event stream. That leaves the shape of the
projection open.

The constraints:

- Handlers will have bugs. When one is fixed, historical data must be reprocessable
  without re-fetching the whole chain from Stellar.
- Reorgs mean the same event can arrive more than once. Ingestion has to be idempotent.
- The product needs relational queries (a participant's transfers, aggregates by
  material type) and text search over participants and materials.
- On-chain values are `u128` weights and `i128` microdegree coordinates, which do not
  fit a 64-bit integer.

## Decision

We will use Postgres with a two-layer schema:

1. **`raw_events`** — an append-only log of every event as received:
   `ledger_sequence`, `ledger_close_time`, `transaction_hash`, `contract_id`,
   `event_type`, `topic TEXT[]`, `value JSONB`. This is the replay source of truth
   off-chain.
2. **Projected tables** — `participants`, `wastes`, `waste_transfers`,
   `token_rewards`, `auctions`, `carbon_credits`, plus operational tables
   (`sync_status`, `alert_history`, `migrations`). These are derived and rebuildable.

Supporting decisions:

- **Idempotency** comes from a unique index on
  `(transaction_hash, event_type, topic[1])`, so a replayed or reorg-duplicated event
  cannot be double-inserted.
- **Domain constraints are expressed as `CHECK`s** on `role`, `waste_type`, and
  `severity`, mirroring the contract's enums.
- **Search uses generated `TSVECTOR` columns** with GIN indexes on `participants` and
  `wastes`, rather than a separate search service.
- **Weights use `NUMERIC`**, not `BIGINT`, since on-chain values are `u128`.
- **Migrations are plain sequential SQL** in `indexer/src/db/migrations/`, tracked in a
  `migrations` table and applied by `migrate.ts`.

## Alternatives Considered

| Alternative                                 | Why it was rejected                                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projected tables only, no `raw_events`      | A handler bug would be unrecoverable without re-fetching history from Stellar. `raw_events` makes `POST /replay` a local operation.                                                                        |
| `raw_events` only, query the JSONB directly | No referential integrity, no cheap aggregation, and every consumer would have to know the event encoding.                                                                                                  |
| A document store (MongoDB, etc.)            | The queries are relational — transfers join participants join wastes. Losing joins and constraints to gain schema flexibility is the wrong trade for a projection whose shape is dictated by the contract. |
| Elasticsearch as the primary store          | Kept as an optional add-on for advanced search (`docker-compose.elasticsearch.yml`), but Postgres full-text search covers the product's needs without a second stateful system in the critical path.       |
| An ORM with generated migrations            | Plain SQL keeps the applied DDL reviewable and makes index and constraint intent explicit.                                                                                                                 |
| `BIGINT` for weights                        | Overflows `u128` on-chain values.                                                                                                                                                                          |

## Consequences

### Positive

- Replay is a local operation: fix a handler, `POST /replay`, done.
- Reorg-safe ingestion via the unique index, with no application-level dedup logic.
- Real joins, aggregates, and full-text search with one stateful dependency.
- Sequential SQL migrations are easy to review and to reason about in deploys.

### Negative

- **`raw_events` grows without bound** and is never pruned by the current schema. It is
  the largest table and needs a retention or partitioning strategy as volume grows.
- **Storage duplication:** every event is stored twice, once raw and once projected.
- The `CHECK` constraints on `role` and `waste_type` **duplicate the contract's enums**.
  Adding a variant on-chain requires a migration here, and forgetting it causes
  ingestion to fail on the new value rather than degrade gracefully.
- Generated `TSVECTOR` columns are recomputed on every write to those rows.
- `BIGINT` and `NUMERIC` columns are returned as **strings** by the `pg` driver, which
  surfaces in the public API and surprises consumers who expect JSON numbers.

### Neutral

- `wastes.recycler_address` has a foreign key to `participants(address)`, so
  participant registration must be indexed before any waste referencing it. Out-of-order
  ingestion has to be handled.
- Projected tables can be dropped and rebuilt; `raw_events` cannot.

## Compliance

Schema changes go in a new numbered file in `indexer/src/db/migrations/` — never by
editing an applied migration.

Reviewers should check that a PR touching the indexer:

- keeps every projected table reconstructible from `raw_events` alone. A handler that
  depends on data not present in the event stream breaks replay and violates this ADR;
- preserves the idempotency index when changing ingestion;
- adds a matching migration when a contract enum gains a variant;
- updates [`docs/API_REFERENCE.md`](../API_REFERENCE.md) when a column reaches the
  public API surface.
