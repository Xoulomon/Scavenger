# ADR-0011: Gate unfinished features with typed flag constants and a single `useFeatureFlag` hook

- **Status:** Accepted
- **Date:** 2026-10-16 (decision recorded from [FEATURE_FLAGS_GUIDE.md](../FEATURE_FLAGS_GUIDE.md))
- **Deciders:** Frontend maintainers
- **Related:** [ADR-0006](./0006-wallet-based-authentication-flow.md)

---

## Context

Features such as contract upgrades and new circuits need to ship dark, so they can merge before they are ready and be enabled per environment. Flags written as ad hoc string literals had typos that silently disabled features, and nobody could list which flags existed.

## Decision

We will define every flag in one `FEATURE_FLAGS` object, read flags only through `useFeatureFlag`, and keep each flag's default `false`. Flags are removed with `scripts/remove-feature-flag.sh` once a feature is permanently on or off.

## Alternatives Considered

| Alternative | Why it was rejected |
|-------------|---------------------|
| Remote flag service (LaunchDarkly or similar) | Adds a paid dependency and a network call on first render for a team this size. |
| Environment variables read at build time | Cannot change per user or per test without a rebuild. |
| String literals at each call site | Typos fail silently, and there is no single list to audit. |

## Consequences

### Positive

- `scripts/audit-feature-flags.sh` can list every flag and its usage.
- Tests can render components with explicit flag values through `FeatureFlagProvider`.

### Negative

- Flags are only as safe as their removal. Stale flags accumulate unless the cleanup script is run.

### Neutral

- Backend and contract changes that need gating use their own mechanisms and are not covered here.

## Compliance

- New flags appear in `FEATURE_FLAGS` and in the table in [FEATURE_FLAGS_GUIDE.md](../FEATURE_FLAGS_GUIDE.md). Reading a flag with a string literal does not comply.
