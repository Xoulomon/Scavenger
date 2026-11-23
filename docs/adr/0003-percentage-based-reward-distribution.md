# ADR-0003: Distribute rewards by configurable percentage

- **Status:** Accepted
- **Date:** Backfilled 2026-07-24; decision predates the ADR log
- **Deciders:** Core contributors
- **Related:** [ADR-0004](./0004-contract-storage-key-layout.md)

> Migrated from the inline ADR section of [ARCHITECTURE.md](../ARCHITECTURE.md), which
> is where this decision was originally recorded.

## Context

A single recycled item passes through several hands: the recycler who submits it, one
or more collectors who move it, and the manufacturer who consumes it. When the reward
is paid, it has to be split among them.

The split needs to be adjustable — the right incentive balance is an economic question
that will not be answered correctly on the first try, and it may need to differ by
market or by season.

## Decision

We will split rewards by configurable percentages held in contract storage, rather
than by fixed amounts baked into the contract.

The collector and owner shares are stored together in a single `RewardConfig` struct
under the `RWD_CFG` instance key, and are set by admins via `set_percentages`.

## Alternatives Considered

| Alternative                                      | Why it was rejected                                                                                                                                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed reward amounts per material type           | Cannot respond to token price movements or changed incentive needs without a contract upgrade.                                                                                                                                                                                              |
| Percentages hard-coded as constants              | Same problem: tuning the economics would require redeploying.                                                                                                                                                                                                                               |
| Two separate storage keys (`COL_PCT`, `OWN_PCT`) | This was the original layout. Consolidated into `RWD_CFG` so one storage read fetches both values, halving instance-storage lookups on every reward path. The old keys are unused and expire with the instance TTL; deployments upgraded from that layout must call `set_percentages` once. |

## Consequences

### Positive

- The incentive structure can be tuned without a contract upgrade.
- One storage read per reward calculation instead of two.
- Splits are transparent on-chain and auditable after the fact.

### Negative

- **Admins can change payout economics.** This is real centralisation and it needs
  governance: multi-sig approval (`MS_THRESH`, `AdminAction::SetPercentages`) exists
  precisely because this decision creates the power to change what people get paid.
- Participants may dispute a payout made under a percentage set after they submitted
  material. An audit trail is required, not optional.
- Percentage arithmetic needs care about rounding and about the sum of shares.

### Neutral

- Creates an ongoing admin responsibility rather than a set-and-forget parameter.
- Percentage changes should be announced ahead of taking effect.

## Compliance

Reward splits are read from `RWD_CFG` in the reward path. A change that reintroduces
hard-coded amounts, or that lets percentages be set outside the multi-sig admin flow,
contradicts this ADR.
