# ADR-0012: Run an active-passive multi-region deployment with DNS failover

- **Status:** Accepted
- **Date:** 2026-10-16 (decision recorded from [MULTI_REGION_ARCHITECTURE.md](../MULTI_REGION_ARCHITECTURE.md))
- **Deciders:** Platform / Operations
- **Related:** [ADR-0002](./0002-off-chain-event-driven-indexing.md), [ADR-0005](./0005-indexer-relational-schema.md)

---

## Context

The platform's indexer and API are the only off-chain path to supply-chain data, so a single-region outage stops operators from recording handoffs. Recovery targets need a defined RTO and RPO. Running active-active would require conflict handling for the indexer's relational schema, which we have not designed.

## Decision

We will run the stack in a primary region (us-east-1) and a warm standby (us-east-2). Route53 failover routing sends traffic to the standby when the primary's health checks fail. The database replicates to the standby with a stated RPO under one second, and failback is a manual step.

## Alternatives Considered

| Alternative | Why it was rejected |
|-------------|---------------------|
| Active-active across regions | Requires conflict resolution for indexer writes, which the schema does not support yet. |
| Single region with backups only | RTO measured in hours, which the operations team judged too long for a supply-chain system. |
| Synchronous cross-region replication | Adds write latency on every indexed event for a durability gain the RPO target does not need. |

## Consequences

### Positive

- The standby can take over without redesign, and failover is scripted (`scripts/multi-region-failover.sh`).

### Negative

- Writes not yet replicated at the moment of failover can be lost, bounded by the RPO.
- The standby costs money while idle.

### Neutral

- Failback is manual on purpose, so a flapping primary does not bounce traffic.

## Compliance

- Failover and health checks follow [MULTI_REGION_OPERATIONS.md](../MULTI_REGION_OPERATIONS.md). Changes that make the standby write-active require a new ADR.
