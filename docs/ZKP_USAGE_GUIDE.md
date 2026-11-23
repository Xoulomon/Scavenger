# Zero-Knowledge Proof Usage Guide

_Issue #816 — Scavngr Soroban Contract_

## Overview

Full ZK proof systems (zk-SNARK, zk-STARK) require arbitrary-precision field
arithmetic and a randomness source — neither is available in a Soroban WASM
environment. The `zkp` module implements a **hash-based commitment scheme**,
the foundational building block of all practical ZKP systems.

The scheme provides:

| Property    | Guarantee                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| **Hiding**  | The commitment `SHA-256(v ‖ nonce)` reveals nothing about `v`.                                                       |
| **Binding** | A committer cannot find two different `(v, nonce)` pairs with the same commitment (collision resistance of SHA-256). |

---

## Commit–Reveal protocol

```
Prover (off-chain)                 Contract (on-chain)
─────────────────                  ───────────────────

1. choose random nonce (32 bytes)
2. commitment = SHA-256(v ‖ nonce)
3. call store_commitment(addr, id, commitment, expires_at)
                                   ← stores CommitmentRecord, status=Pending
                                   ← emits "com_new" event

   ... time passes, some other condition is met ...

4. call reveal_commitment(addr, id, v, nonce)
                                   ← recomputes SHA-256(v ‖ nonce)
                                   ← checks == stored commitment
                                   ← marks status=Verified
                                   ← emits "com_vfy" event
                                   ← contract can now act on v
```

---

## API reference

### `compute_commitment(env, secret, nonce) → Commitment`

Computes `SHA-256(secret ‖ nonce)`. Call this **off-chain** in your client.

```rust
let secret: BytesN<32> = ...; // the value you want to hide
let nonce:  BytesN<32> = ...; // 32 random bytes (use crypto.getRandomValues)
let commitment = zkp::compute_commitment(&env, &secret, &nonce);
```

### `store_commitment(env, committer, commitment_id, hash, expires_at)`

Stores the commitment on-chain. `expires_at = 0` means no expiry.

```rust
zkp::store_commitment(&env, &caller, 1, commitment, 0);
```

### `reveal_commitment(env, committer, commitment_id, secret, nonce) → Result<(), CommitmentError>`

Verifies the preimage. On success marks the record `Verified`.

```rust
zkp::reveal_commitment(&env, &caller, 1, &secret, &nonce)?;
// Now safe to act on `secret`
```

### `cancel_commitment(env, committer, commitment_id) → Result<(), CommitmentError>`

Cancels a pending commitment. Requires prior `committer.require_auth()`.

### `get_commitment(env, committer, commitment_id) → Result<CommitmentRecord, CommitmentError>`

Reads the stored record without consuming it.

---

## Practical example: private weight submission

A recycler wants to commit to a waste weight before the collector sees it, to
prevent front-running.

```rust
// 1. Client computes commitment (TypeScript / JS)
const secret = new Uint8Array(32);  // encode weight as big-endian u32 in first 4 bytes
const nonce  = crypto.getRandomValues(new Uint8Array(32));
const commitment = sha256(concat(secret, nonce));

// 2. Submit commitment (contract invocation)
contract.store_commitment(myAddress, 1, commitment, expiresAt);

// 3. After collector acknowledges, reveal
contract.reveal_commitment(myAddress, 1, secret, nonce);

// 4. Contract verifies and records the weight
```

---

## CommitmentStatus lifecycle

```
                   cancel
   Pending ──────────────────→ Cancelled
      │
      │  reveal (correct preimage)
      ↓
   Verified

      │  reveal (past expires_at)
      ↓
   Expired
```

---

## Error codes

| Error             | Meaning                                            |
| ----------------- | -------------------------------------------------- |
| `NotFound`        | No commitment stored for this `(committer, id)`    |
| `HashMismatch`    | Supplied preimage does not match stored commitment |
| `AlreadyVerified` | Commitment was already revealed                    |
| `Cancelled`       | Commitment was cancelled                           |
| `Expired`         | Commitment expired before reveal                   |
| `NotPending`      | Cannot cancel a non-pending commitment             |

---

## Events

| Symbol    | Trigger                     | Data                         |
| --------- | --------------------------- | ---------------------------- |
| `com_new` | `store_commitment`          | `(committer, commitment_id)` |
| `com_vfy` | `reveal_commitment` success | `(committer, commitment_id)` |
| `com_cnc` | `cancel_commitment`         | `(committer, commitment_id)` |

---

## Security considerations

1. **Nonce must be truly random** — a weak nonce allows brute-force preimage
   attacks. Use `crypto.getRandomValues` in JavaScript or `OsRng` in Rust.
2. **Secret must be high-entropy** — if the secret space is small (e.g. a
   weight in grams from 100 to 10 000 000) an attacker can try all values
   offline. In that case encode additional private context alongside the
   weight in the `secret` bytes.
3. **Commitment ID must be unique per committer** — reusing the same `(addr,
id)` panics on `store_commitment`.
4. **Set a reasonable `expires_at`** — prevents commitments from occupying
   storage indefinitely. Recommended: current timestamp + 86 400 (24 hours).

---

## Performance

| Operation           | Approx. CPU instructions    |
| ------------------- | --------------------------- |
| `store_commitment`  | ~500                        |
| `reveal_commitment` | ~900 (includes one SHA-256) |
| `cancel_commitment` | ~600                        |

See `ZkpCostHints` in `src/zkp.rs` for the constants used.
