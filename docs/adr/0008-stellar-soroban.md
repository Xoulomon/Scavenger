# ADR: Stellar/Soroban as the Settlement Layer

- **Status:** Accepted
- **Date:** see git history
- **Deciders:** Scavenger maintainers
- **Issue:** [#1325](https://github.com/Xoulomon/Scavenger/issues/1325)

## Context

Scavenger records recycling events, transfers custody of waste between
participants, and distributes incentives. The contract layer needs a
chain that can:

- settle small-value transfers cheaply and predictably
- expose a general-purpose smart-contract runtime
- be operated by contributors without a dedicated validator set
- integrate with existing fiat on/off-ramp providers through a mature
  anchoring standard

Several chains were evaluated at project inception.

## Decision

We build on **Stellar** and use **Soroban** for smart contracts.

## Rationale

### Why Stellar

- **Low, predictable fees.** Settlement of small incentive payouts is
  viable without batching. Fee spikes on general-purpose L1s would make
  micro-rewards unviable.
- **Fast finality.** Closures settle in seconds. Recycling events need
  to be visible to the app quickly for good UX.
- **Purpose-built payments stack.** Anchors, path payments, and asset
  issuance are first-class, which matches the recycling incentive flows
  (issuing and transferring value between participants).
- **Mature ecosystem for on/off-ramps.** Existing SEP standards and
  anchor tooling reduce the amount of custom integration we need.

### Why Soroban (rather than another Stellar contract approach)

- **General-purpose runtime.** Rust-based, typed, and expressive enough
  for our participant/waste/incentive state machine.
- **WASM target.** Compiles to a portable binary with deterministic
  resource accounting (CPU and memory), which is essential for
  predictable costs.
- **Same chain, same asset layer.** Contract state and Stellar assets
  live on the same chain, avoiding bridge risk for the token flows we
  already need.
- **Growing tooling.** Stellar CLI, SDKs, and reference patterns were
  sufficient at the time of writing and continue to mature.

## Alternatives considered

### Ethereum L1

- **Pros:** largest tooling ecosystem, most auditors, mature smart
  contract patterns.
- **Cons:** gas fees at inception made micro-rewards impractical; L1
  finality is slower; users would still need an L2 for cost.

### An EVM L2 (Arbitrum, Optimism, Base)

- **Pros:** cheap execution, EVM tooling, fast finality.
- **Cons:** the settlement layer underneath is Ethereum L1; payout flows
  depend on L1 finality for safety guarantees. Adds bridging assumptions
  for any Stellar-based asset partners.

### Solana

- **Pros:** very low fees, fast finality, active community.
- **Cons:** less mature on/off-ramp tooling at inception; Rust runtime
  is expressive but the contract-development story for payments was less
  established than Stellar's at the time.

### A dedicated appchain

- **Pros:** full control over parameters.
- **Cons:** we would operate validators, hire auditors, and maintain a
  chain — none of which serves the product's core loop. Operational
  cost exceeds any benefit at our current size.

## Tradeoffs we accepted

- **Tooling maturity.** Soroban tooling was newer than EVM tooling at
  inception. We accepted slower iteration in exchange for a payments-
  native chain.
- **Smaller audit ecosystem.** Fewer Soroban auditors exist; each audit
  takes longer to source.
- **Fewer developers familiar with Soroban.** Onboarding cost is higher
  than Solidity. Mitigated by keeping the contract surface small and
  well-documented.
- **Ecosystem lock-in.** Our contract state and asset flows are on
  Stellar. Migrating later would require a bridge or a full rewrite.

## Consequences

### Positive
- Low, predictable settlement fees for micro-rewards.
- Fast finality for user-visible flows.
- Native support for the asset and anchor flows we need.

### Negative
- Smaller hiring pool of Soroban developers.
- Longer audit lead times than EVM equivalents.
- Ecosystem tooling moves on a different cadence than we may want.

### Neutral
- We may add L2-style batching or rollup patterns later if throughput
  demands it; the ADR is compatible with that.

## References

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/)
- [ADR 0001 — Multi-Service Architecture](./0001-multi-service-architecture.md)
- Issue [#1325](https://github.com/Xoulomon/Scavenger/issues/1325)
