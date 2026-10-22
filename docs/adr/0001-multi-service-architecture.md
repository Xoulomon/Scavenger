# ADR 0001: Multi-Service Architecture

- **Status:** Proposed
- **Date:** <today>
- **Deciders:** <maintainer names>
- **Issue:** [#1322](https://github.com/Xoulomon/Scavenger/issues/1322)

## Context

The Scavenger repository spans five services: `stellar-contract`,
`indexer`, `backend`, `frontend`, and `mobile`. Before this ADR, no
document explained **why** the services are split this way or how data
flows between them.

## Decision

We keep the five services separated with the following responsibilities
and boundaries.

### Service boundaries

| Service | Responsibility | Technology |
|---|---|---|
| `stellar-contract/` | On-chain state: participants, waste, incentives, rewards | Rust / Soroban |
| `indexer/` | Off-chain projection of contract events into queryable storage | TypeScript (Node) |
| `backend/` | Authenticated API, business logic, off-chain persistence | Rust |
| `frontend/` | Web UI consumed by recyclers, collectors, manufacturers | React / TypeScript |
| `mobile/` | Mobile companion (currently unmaintained) | React Native |

### Why these boundaries

- **Contract ↔ indexer separation:** the contract must remain small and
  deterministic; the indexer is a read model that can be rebuilt from
  chain history at any time.
- **Indexer ↔ backend separation:** the indexer is chain-shaped, while
  the backend is product-shaped (auth, sessions, off-chain data).
  Merging them would couple chain reorgs to API availability.
- **Backend ↔ frontend separation:** the frontend talks to the backend
  over HTTP/GraphQL only; no direct DB or chain access.
- **Mobile as separate service:** mobile clients have their own release
  cadence and platform-specific code, so they consume the same API as
  the web app but ship independently.

### Data flow

```bash
# Add to README's Documentation table if it has one
grep -q "adr" README.md && echo "already referenced" || \
  sed -i '/^| \[Security Audit\]/a | [ADR: Multi-Service Architecture](docs/adr/0001-multi-service-architecture.md) | Why the repo is split into five services |' README.md

# Also add to docs/ if a docs index exists
[ -f docs/README.md ] && grep -q "adr" docs/README.md || \
  echo "- [ADR: Multi-Service Architecture](adr/0001-multi-service-architecture.md)" >> docs/README.md 2>/dev/null
grep -n "adr\|ADR" README.md docs/README.md 2>/dev/null
```
