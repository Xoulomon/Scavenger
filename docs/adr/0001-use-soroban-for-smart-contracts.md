# ADR-0001: Use Soroban and Rust for the on-chain contract

- **Status:** Accepted
- **Date:** Backfilled 2026-07-24; decision predates the ADR log
- **Deciders:** Core contributors
- **Related:** [ADR-0002](./0002-off-chain-event-driven-indexing.md), [ADR-0004](./0004-contract-storage-key-layout.md)

> Migrated from the inline ADR section of [ARCHITECTURE.md](../ARCHITECTURE.md), which
> is where this decision was originally recorded.

## Context

Scavngr tracks recyclable material through a supply chain and pays rewards for
verified handoffs. The chain of custody and the reward arithmetic have to be
tamper-evident, which puts them on-chain.

Stellar was the target network. Within Stellar, contract logic can be written for the
Soroban runtime, which compiles Rust to WASM. Off-chain alternatives were also on the
table, since not every part of the system strictly needs consensus.

## Decision

We will implement the supply-chain and reward logic as a Soroban smart contract
written in Rust, in `stellar-contract/`.

## Alternatives Considered

| Alternative                                                     | Why it was rejected                                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A JavaScript/TypeScript backend holding the authoritative state | No tamper-evidence. The custody chain and reward payouts are exactly the things participants need to be able to verify without trusting us.                        |
| A different chain with a more familiar contract language        | Stellar was already the target network for payments and asset issuance. Bridging to a second chain would add a trust boundary and operational surface for no gain. |
| Thin on-chain contract with most logic off-chain                | Rejected for the custody and reward paths, but _accepted_ for queries and analytics — see [ADR-0002](./0002-off-chain-event-driven-indexing.md).                   |

## Consequences

### Positive

- Custody transfers and reward distribution are verifiable by anyone, without trusting
  the project's infrastructure.
- Rust's type system catches a large class of errors before deployment, which matters
  disproportionately for code that cannot be hot-patched.
- Native to Stellar: no bridge, no second chain, no wrapped assets.

### Negative

- Steeper contributor ramp. Contributors comfortable with the TypeScript frontend
  cannot necessarily work on the contract.
- Deployed contract logic is expensive to change. Fixes require an upgrade flow rather
  than a redeploy — see `docs/CONTRACT_UPGRADE_RUNBOOK.md`.
- Storage is metered and rent-bearing, which constrains the schema in ways a
  relational database does not — see [ADR-0004](./0004-contract-storage-key-layout.md).

### Neutral

- The contract owns state mutation; every read-heavy path is served off-chain
  ([ADR-0002](./0002-off-chain-event-driven-indexing.md)).
- Authorisation is delegated to Soroban's `require_auth`, which shapes the
  authentication design ([ADR-0006](./0006-wallet-based-authentication-flow.md)).

## Compliance

Contract source lives in `stellar-contract/src/`. Any proposal to move custody or
reward logic off-chain contradicts this ADR and needs a superseding one.
