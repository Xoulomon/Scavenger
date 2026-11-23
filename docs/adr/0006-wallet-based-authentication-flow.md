# ADR-0006: Authenticate with wallet signatures; treat frontend session state as UI only

- **Status:** Accepted
- **Date:** Backfilled 2026-07-24; decision predates the ADR log
- **Deciders:** Core contributors
- **Related:** [ADR-0001](./0001-use-soroban-for-smart-contracts.md), [ADR-0002](./0002-off-chain-event-driven-indexing.md); `frontend/src/context/WalletContext.tsx`, `frontend/src/context/AuthContext.tsx`

## Context

Participants are identified by their Stellar address. Every state-changing action —
registering, submitting material, transferring custody, confirming receipt — is a
contract call made by that address.

That means the question "is this user who they claim to be?" already has an answer at
the contract boundary: Soroban's `require_auth` will reject the invocation unless the
transaction carries a valid signature from the address in question. There are 62
`require_auth` call sites in `stellar-contract/src/lib.rs`.

The open question was whether to _also_ build a conventional account system —
credentials, server-issued sessions, a user table — on top of that.

## Decision

We will use **wallet signatures as the sole authentication mechanism**, and treat the
frontend's notion of a logged-in user as **presentation state, not a security
boundary**.

Concretely:

- **Wallet connection** is via the Freighter browser extension
  (`@stellar/freighter-api`), managed by `WalletContext`. The connected address is
  cached in `localStorage` under `wallet_address` so a page reload does not force a
  reconnect.
- **Authorisation is enforced on-chain.** Each contract function calls
  `caller.require_auth()`. Privileged functions additionally check membership in the
  `ADMINS` list via `only_admin`, which does `require_auth` _and_ a membership test —
  holding a key is not the same as being an admin.
- **`AuthContext` holds display state only** — address, role, name, cached in
  `localStorage` under `scavngr_user`. It gates what the UI renders. It is not
  consulted by anything that enforces a security property.
- **The indexer REST API is unauthenticated**, because it serves data that is already
  public on-chain. Operators are expected to place any access control at the gateway.

## Alternatives Considered

| Alternative                                            | Why it was rejected                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email/password accounts with server sessions           | Introduces credential storage, reset flows, and breach liability for an identity the chain already establishes cryptographically. It would also create a second identity to reconcile with the on-chain address.                                               |
| Sign-In-With-Stellar: sign a nonce, exchange for a JWT | The standard pattern, and worth revisiting **if** a server endpoint ever needs to authorise a caller. Today no such endpoint exists: writes go to the contract and reads are public. A token system with nothing to protect is attack surface without benefit. |
| Custodial key management                               | Removes the wallet-install friction, but makes the project a custodian of user funds and identity. Wrong trade for a supply-chain tracking application.                                                                                                        |
| Authenticating the indexer API                         | The data is public on-chain; authenticating it protects nothing. **`POST /replay` is the exception** and is a genuine gap — see below.                                                                                                                         |

## Consequences

### Positive

- No credential storage, no password reset flow, no session-fixation surface.
- Authorisation cannot be bypassed by manipulating the client, because it is enforced
  by the network, not by our code.
- One identity end to end: the Stellar address is the user ID in the contract, the
  indexer, and the UI.
- Admin privilege is a membership test against on-chain state, so it survives a
  compromised frontend.

### Negative

- **`localStorage` is readable by any script on the origin.** Only a public address is
  stored, so there is no secret to steal — but an XSS that rewrites `wallet_address`
  can mislead the UI about which account is active. The user is still protected at
  signing time, because Freighter shows what is being signed and holds the key.
- **`AuthContext` is trivially forgeable.** Writing a `scavngr_user` object into
  `localStorage` makes the UI render as that user. This is acceptable _only_ because
  nothing security-relevant depends on it, and it stops being acceptable the moment a
  server endpoint trusts it. That constraint is easy to violate accidentally.
- **Freighter is a hard dependency** for any state-changing action. Users without the
  extension can browse but cannot participate; mobile support is constrained by wallet
  availability.
- **`POST /replay` on the indexer is unauthenticated and mutating.** It re-dispatches
  stored events through handlers that write derived tables. It must not be exposed to
  the internet. This is a real gap in the current posture, documented in
  [`docs/API_REFERENCE.md`](../API_REFERENCE.md) rather than fixed in code.
- No server-side notion of a session means no server-side revocation, rate limiting per
  user, or audit of "who was logged in" beyond what the chain records.

### Neutral

- `AuthContext` contains a placeholder comment about checking for a stored token. If a
  token flow is ever added, it should arrive as a superseding ADR, not as an
  incremental edit — the "frontend state is not a security boundary" invariant is the
  thing most likely to be lost by accident.
- The backend service carries `CSRF_SECRET` and `ALLOWED_ORIGINS` configuration for
  its own endpoints; those are separate from this decision.

## Compliance

The invariant to protect: **no server-side or contract-side decision may depend on
`AuthContext`, `scavngr_user`, or `wallet_address`.** Those are UI hints.

Reviewers should check that a PR:

- enforces new privileged contract functions with `require_auth`, and `only_admin`
  where admin rights are required;
- does not introduce a server endpoint that trusts a client-supplied address without a
  signature check — that requires a superseding ADR;
- does not place a mutating endpoint on the indexer without a plan for guarding it.
