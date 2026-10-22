# ADR-0013: Keep one `#[contractimpl]` facade in `lib.rs` and put domain logic in per-domain modules

- **Status:** Accepted
- **Date:** 2026-10-16 (decision recorded from the layout of `stellar-contract/src`)
- **Deciders:** Contract maintainers
- **Related:** [ADR-0001](./0001-use-soroban-for-smart-contracts.md), [ADR-0004](./0004-contract-storage-key-layout.md), [ADR-0009](./0009-error-contract-envelope.md)

---

## Context

The contract has grown to more than 200 public entrypoints spread across waste, transfer, participant, incentive, verification and export domains. Soroban requires the exported functions to live in a single `#[contractimpl]` block, and large files there are hard to review.

## Decision

We will keep every exported entrypoint in the `#[contractimpl]` block in `stellar-contract/src/lib.rs`. Each entrypoint is a thin wrapper that delegates to a domain module (`waste_mgmt.rs`, `transfer_mgmt.rs`, `participant_mgmt.rs`, `incentive_mgmt.rs`, `verification.rs` and so on). Shared types live in `types.rs` and errors in `errors.rs`. Storage keys live in `storage_keys.rs` (see ADR-0004).

## Alternatives Considered

| Alternative | Why it was rejected |
|-------------|---------------------|
| One `#[contractimpl]` block per domain | Splits the public interface across blocks, so the entrypoint list that SDK consumers rely on has to be reassembled from several places. |
| Put logic directly in `lib.rs` | Makes review and unit testing of domain rules harder. |
| Separate contracts per domain | Multiplies deployment, auth and cross-contract call cost for a single supply-chain flow. |

## Consequences

### Positive

- Domain logic can be unit-tested without going through the entrypoint layer.
- `lib.rs` is the single list of what the contract exposes.

### Negative

- `lib.rs` is still large, and a new entrypoint touches two files.

### Neutral

- Public entrypoints are documented in [sdk-api-reference.md](../sdk-api-reference.md), and internal notes in [CONTRACT_DOCUMENTATION.md](../CONTRACT_DOCUMENTATION.md).

## Compliance

- New exported functions are declared in `lib.rs` and delegate to a domain module. Adding business logic directly in `lib.rs` does not comply.
