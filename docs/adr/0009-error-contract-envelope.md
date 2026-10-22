# ADR-0009: Emit errors as a single JSON envelope with stable `category.variant` codes

- **Status:** Accepted
- **Date:** 2026-10-16 (decision recorded from [ERROR_CONTRACT.md](../ERROR_CONTRACT.md); the contract predates this ADR)
- **Deciders:** Core Engineering
- **Related:** [ADR-0007](./0007-multichain-backend-boundary.md), [ERROR_CONTRACT.md](../ERROR_CONTRACT.md)

---

## Context

The backend and indexer both return errors to clients, and the frontend and mobile apps branch on them. Before a shared contract existed, each service picked its own shape and clients keyed logic on HTTP status text or on free-form messages. Those messages change with copy edits, so client behaviour broke silently.

## Decision

We will return every service error as one JSON envelope: `{ "error": { "code", "message", "status", "fields"? } }`.

- `code` is `<category>.<variant>` (for example `auth.token_expired`, `validation.*`) and is **stable across releases**.
- `status` mirrors the HTTP status, but clients must key logic on `code`, because the HTTP status may change.
- `fields` appears only for `validation.*` codes.

## Alternatives Considered

| Alternative | Why it was rejected |
|-------------|---------------------|
| Plain HTTP status plus a free-text message | Clients would parse messages, which change with copy edits. |
| RFC 7807 `problem+json` | Workable, but it adds a second envelope to maintain without giving clients anything `code` does not already provide. |
| Per-service error shapes | The frontend would need a branch per service, and the naming already drifted (see #1153). |

## Consequences

### Positive

- Clients can match on a code that survives refactors and copy changes.
- One table in [ERROR_CONTRACT.md](../ERROR_CONTRACT.md) is the review point for new errors.

### Negative

- Every new error variant needs a code and a table entry, which adds friction to small changes.
- The status field can disagree with what a proxy reports, so logs must record `code`, not only status.

### Neutral

- Backend and indexer naming has to be kept aligned by hand; #1153 tracks the remaining drift.

## Compliance

- The table in [ERROR_CONTRACT.md](../ERROR_CONTRACT.md) is the canonical list. A PR that adds an error code without a row there does not comply.
- Error construction lives in `backend/src/errors` and `indexer/src/errors`.
