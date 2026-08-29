# Architecture Decision Records

This is Scavngr's decision log. It records the architectural choices the project has
made, why they were made, and what they cost — so that a change which quietly
contradicts one is visible as such in review.

An ADR is not documentation of how the system works; that lives in
[`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) and its siblings. An ADR captures the
*reasoning* that produced a design, including the alternatives that lost. That
reasoning is the part that is otherwise lost when contributors move on.

## Index

| # | Title | Status | Area |
|---|-------|--------|------|
| [0001](./0001-use-soroban-for-smart-contracts.md) | Use Soroban and Rust for the on-chain contract | Accepted | Contract |
| [0002](./0002-off-chain-event-driven-indexing.md) | Serve queries from an off-chain event-driven indexer | Accepted | Indexer |
| [0003](./0003-percentage-based-reward-distribution.md) | Distribute rewards by configurable percentage | Accepted | Contract |
| [0004](./0004-contract-storage-key-layout.md) | Tier contract storage by access pattern, with typed tuple keys | Accepted | Contract |
| [0005](./0005-indexer-relational-schema.md) | Project events into a normalised Postgres schema, keeping raw events | Accepted | Indexer |
| [0006](./0006-wallet-based-authentication-flow.md) | Authenticate with wallet signatures; treat frontend session state as UI only | Accepted | Frontend / Auth |
| [0007](./0007-multichain-backend-boundary.md) | Multichain and Contract Upgrade Boundaries in the Backend Service | Accepted | Backend / Architecture |

Template: [`template.md`](./template.md)

## Status values

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion; not yet binding |
| **Accepted** | Binding. Code that contradicts it should be challenged in review |
| **Deprecated** | No longer applies, and nothing replaced it |
| **Superseded** | Replaced by a later ADR, which is linked from the header |

## Writing a new ADR

1. Copy [`template.md`](./template.md) to `NNNN-short-slug.md`, using the next unused
   number.
2. Fill it in. The **Alternatives Considered** and the negative half of
   **Consequences** are the sections that earn the ADR its keep — an ADR with an empty
   alternatives table has not recorded a decision, only an outcome.
3. Add a row to the index above.
4. Open the PR with the change the ADR justifies, or on its own if the decision comes
   first.

## Amending an ADR

Accepted ADRs are immutable in substance. If a decision changes, write a new ADR and
set the old one's status to `Superseded by [ADR-NNNN]`. Do not rewrite history — the
value of the log is that it records what was believed at the time, including what
turned out to be wrong.

Correcting a typo, a broken link, or a statement that was factually wrong about the
code is an edit, not a supersession.

## When to write one

Write an ADR for decisions that are expensive to reverse, or that a future contributor
could plausibly undo without realising it was a decision at all:

- on-chain storage layout and tiering
- database schema shape and migration strategy
- trust boundaries and authentication
- protocol, network, or major dependency commitments
- anything where the obvious-looking change is the wrong one

Do not write one for routine implementation choices, library version bumps, or
decisions that are cheap to revisit.

## A note on numbering

ADRs 0001–0003 were originally recorded inline in `docs/ARCHITECTURE.md` and were
migrated here when this log was created, keeping their original numbering. ADRs
0004–0006 were backfilled at the same time for decisions that had never been written
down: contract storage keys, the indexer schema, and the authentication flow.

Backfilled ADRs carry a "Backfilled" note in their date field. Their Context sections
reconstruct the reasoning from the code and from the constraints in force at the time;
where the original discussion is not recoverable, they say what the code implies
rather than inventing a debate that may not have happened.
