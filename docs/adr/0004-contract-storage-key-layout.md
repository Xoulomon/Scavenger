# ADR-0004: Tier contract storage by access pattern, with typed tuple keys

- **Status:** Accepted
- **Date:** Backfilled 2026-07-24; decision predates the ADR log
- **Deciders:** Core contributors
- **Related:** issue #758; [ADR-0001](./0001-use-soroban-for-smart-contracts.md); [`docs/DATABASE_SCHEMA.md`](../DATABASE_SCHEMA.md)

## Context

Soroban charges for storage in two ways that pull in opposite directions:

1. **Read cost.** Instance storage is a single ledger entry. Every invocation loads it
   in full, so anything placed there is paid for on _every_ call, whether or not it is
   read.
2. **Rent and expiry.** Every entry has a TTL. Instance storage expires as a unit;
   persistent entries expire individually and are archived; temporary entries expire
   individually and are **deleted outright**.

The contract has grown to well over a hundred distinct storage keys spanning config
scalars, per-entity records, counters, indexes, and caches. Without a stated policy,
each new feature picks a tier by local convenience, and the result is either an
inflated per-call read cost or data placed somewhere it can be permanently lost.

Soroban also caps `symbol_short!` keys at 9 characters, which forces abbreviation and
makes keys easy to collide or mistype without a convention.

## Decision

We will assign storage to tiers by access pattern, and key entries with typed tuples.

**Tier policy:**

- **Instance** — small scalars and config read on most invocations (`ADMINS`,
  `RWD_CFG`, `PAUSED`, `RE_GUARD`, counters), plus the bulk of per-entity records.
  Kept deliberately small to hold down the base read fee.
- **Persistent** — per-entity records that must survive independently of the instance
  and that are acceptable to restore on demand (participant records via
  `participant.rs`, compliance reports, performance snapshots, the search index).
- **Temporary** — **caches only**. Nothing may live in temporary storage that cannot
  be recomputed from a durable tier, because temporary expiry is unrecoverable.

**Key policy:**

- Config scalars use `Symbol` constants declared together at the top of `lib.rs`, each
  with a comment naming the feature or issue that introduced it.
- Per-entity records use tuple keys — `("waste", waste_id)`, `("stats", address)` —
  rather than concatenated strings, avoiding string hashing on every access.
- Every externally-invokable function calls `storage_utils::bump_instance` first,
  extending the instance TTL by 518 400 ledgers (~30 days at 5 s/ledger).

## Alternatives Considered

| Alternative                                                       | Why it was rejected                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A single `DataKey` enum for all keys, as in many Soroban examples | Clean in principle, but every variant addition changes the enum's XDR encoding, which is a migration risk across upgrades for a contract this broad. Independent `Symbol` constants and tuple keys let features be added without touching a shared type. |
| Put everything in persistent storage                              | Loses the single-entry read efficiency of instance storage for the hot config path, and multiplies the number of entries paying rent individually.                                                                                                       |
| Put everything in instance storage                                | Every invocation would load the entire contract state. Read cost grows without bound as features are added.                                                                                                                                              |
| String-concatenated keys (`"waste_" + id`)                        | Pays string construction and hashing on every access, and makes key collisions a runtime surprise rather than a type error.                                                                                                                              |

## Consequences

### Positive

- Per-invocation read cost stays bounded by keeping the hot set small.
- Tuple keys are cheap and type-checked at the call site.
- Because instance storage bumps as a unit, one `bump_instance` call keeps all
  instance-keyed data alive — no per-key TTL bookkeeping in normal operation.
- The "temporary is cache-only" rule makes temporary expiry a non-event: a miss always
  falls back to a durable tier.

### Negative

- **The 9-character symbol limit forces cryptic names** (`RWD_CFG`, `MS_THRESH`,
  `PXFR_CNT`). The mapping from constant name to on-chain symbol has to be documented
  or the keys are unreadable.
- **Renaming a key silently orphans data.** A read against a renamed key returns
  `None` rather than erroring, so a rename that looks like a refactor is actually a
  migration. This already happened once: `COL_PCT`/`OWN_PCT` → `RWD_CFG` required a
  one-time `set_percentages` call after upgrade.
- **A contract idle for more than ~30 days has its instance archived** and needs a
  `RestoreFootprint` before the next call succeeds. Low-traffic deployments must plan
  for this.
- Tier assignment is a judgement call made per feature, so it can drift without review
  discipline.

### Neutral

- Participant data is currently reachable through **two** paths: instance-keyed
  `(address,)` in `lib.rs`, and persistent-keyed `("PART", address)` via
  `participant.rs`. New code should prefer the `participant.rs` helpers. Consolidating
  the two is outstanding work.
- Application-level expiries (`waste_ttl`, transfer approval, proposal TTL) are
  measured in **seconds against the ledger timestamp** and are independent of Soroban
  storage TTLs, which are measured in **ledgers**. The two are easy to confuse.

## Compliance

The full key inventory, tier assignment, and TTL policy live in the
[Storage Key Schema section of `docs/DATABASE_SCHEMA.md`](../DATABASE_SCHEMA.md#storage-key-schema).

Reviewers should check that a PR adding storage:

- declares its key as a documented constant or a tuple with a discriminator;
- picks a tier consistent with the policy above — in particular, that nothing
  irreplaceable is written to temporary storage;
- updates `docs/DATABASE_SCHEMA.md` in the same PR;
- treats any key rename as a migration with an explicit upgrade step.
