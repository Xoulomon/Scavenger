# Key Management Guide

_Issue #817 — Scavngr Soroban Contract_

## Overview

The `key_rotation` module provides versioned on-chain storage for cryptographic
key hashes. The actual key material is **never stored on-chain**; only its
SHA-256 hash is stored, enabling integrity verification.

---

## Key purposes

| Variant           | Usage                                               |
| ----------------- | --------------------------------------------------- |
| `WebhookSigning`  | HMAC-SHA256 key for off-chain webhook signatures    |
| `ApiKeyHash`      | Hash of the backend API key for authentication      |
| `ZkpVerification` | Public key hash used to verify off-chain ZKP proofs |
| `PiiEncryption`   | Encryption key hash for participant PII export      |

---

## Lifecycle

```
(no key)
    │  install_key
    ↓
 Active v1
    │  rotate_key
    ↓
 Active v2  +  Archived v1
    │  rotate_key
    ↓
 Active v3  +  Archived v2, Archived v1
    │
    ├── revoke_key_version(v2)  → Revoked v2  (compromise alert)
    │
    └── purge_key_version(v1)   → deleted (storage reclaimed)
```

---

## API reference

### Install a key (first time)

```rust
key_rotation::install_key(env, &admin, KeyPurpose::WebhookSigning, key_hash)?;
```

### Rotate a key

```rust
let new_version = key_rotation::rotate_key(
    env, &admin, KeyPurpose::WebhookSigning, new_key_hash
)?;
```

### Read the active key

```rust
let record: KeyRecord = key_rotation::get_active_key(env, KeyPurpose::WebhookSigning)?;
// record.key_hash is the SHA-256 hash to verify against
```

### Read a specific version (audit trail)

```rust
let old_record = key_rotation::get_key_version(env, KeyPurpose::WebhookSigning, 1)?;
```

### Revoke a compromised key version

```rust
key_rotation::revoke_key_version(env, &admin, KeyPurpose::WebhookSigning, 1)?;
```

### Purge an old version to reclaim storage rent

```rust
key_rotation::purge_key_version(env, &admin, KeyPurpose::WebhookSigning, 1)?;
// Panics if you try to purge the currently active version
```

---

## KeyRecord fields

| Field          | Type         | Description                             |
| -------------- | ------------ | --------------------------------------- |
| `purpose`      | `KeyPurpose` | Slot this key belongs to                |
| `version`      | `u32`        | Monotonically increasing from 1         |
| `key_hash`     | `BytesN<32>` | SHA-256 of the actual secret            |
| `installed_by` | `Address`    | Admin who installed this version        |
| `installed_at` | `u64`        | Ledger timestamp at installation        |
| `archived_at`  | `u64`        | Timestamp when superseded (0 if active) |
| `status`       | `KeyStatus`  | `Active`, `Archived`, or `Revoked`      |

---

## Events

| Symbol    | Trigger              | Data                         |
| --------- | -------------------- | ---------------------------- |
| `key_ins` | `install_key`        | `(purpose_u32, version)`     |
| `key_rot` | `rotate_key`         | `(purpose_u32, new_version)` |
| `key_rev` | `revoke_key_version` | `(purpose_u32, version)`     |
| `key_prg` | `purge_key_version`  | `(purpose_u32, version)`     |

---

## Error codes

| Error               | Meaning                                   |
| ------------------- | ----------------------------------------- |
| `NoActiveKey`       | No key installed for this purpose         |
| `VersionNotFound`   | (purpose, version) does not exist         |
| `Unauthorized`      | Caller is not the admin                   |
| `CannotPurgeActive` | Tried to purge the current active version |
| `ZeroKeyHash`       | Supplied hash is all zeros                |

---

## Security considerations

1. **Never store the raw secret on-chain** — only store `SHA-256(secret)`.
2. **Rotate on schedule** — recommended rotation interval: 90 days.
3. **Revoke immediately on compromise** — use `revoke_key_version`; this
   signals to off-chain consumers that any signature/proof using that key
   version is suspect.
4. **Keep at least 2 versions** — the current active version plus the
   immediately previous one, in case in-flight requests signed with the old key
   need to be verified during the transition window.
5. **Admin authentication** — all mutating functions require the admin to call
   `admin.require_auth()` before dispatching to this module.

---

## Rotation schedule (recommended)

| Purpose           | Rotation interval            |
| ----------------- | ---------------------------- |
| `WebhookSigning`  | 90 days                      |
| `ApiKeyHash`      | 30 days                      |
| `ZkpVerification` | On each ZKP protocol upgrade |
| `PiiEncryption`   | 180 days                     |

---

## Monitoring

Subscribe to `key_rot` and `key_rev` events in the indexer to trigger
rotation alerts. A `key_rev` event should immediately trigger an incident
response procedure.
