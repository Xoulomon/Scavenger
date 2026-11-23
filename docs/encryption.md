# Encryption Guide

## Overview

Scavenger implements data encryption at rest and in transit to protect sensitive information.

## Architecture

### At-Rest Encryption

Uses AES-256-GCM via the `DataEncryptionService` with:

- Automatic nonce generation
- Per-record unique nonces
- Key rotation support

### In-Transit Encryption

TLS 1.3 enforced on all external API communication. Internal services use authenticated channels.

### Key Management

- Keys stored in environment-specific vaults
- Automatic key rotation via `rotate_key()`
- Revocation support for compromised keys
- Metrics tracking for all operations

## Usage

### Encrypt Data

```rust
use scavenger_backend::services::DataEncryptionService;

let service = DataEncryptionService::new();
let encrypted = service.encrypt(b"sensitive data").unwrap();
```

### Decrypt Data

```rust
let decrypted = service.decrypt(&encrypted).unwrap();
```

### Key Rotation

```rust
let new_key_id = service.rotate_key().unwrap();
```

### Verification

```rust
let valid = service.verify_encryption(&encrypted).unwrap();
```

### Monitoring

```rust
let metrics = service.get_metrics();
// metrics.encrypt_operations, metrics.decrypt_operations, etc.
```

## Tests

Run `cargo test --lib services::encryption` to execute encryption tests.

# Encryption Implementation Tasks

## Completed

- [x] Design encryption architecture
- [x] Implement at-rest encryption
- [x] Add in-transit encryption (TLS 1.3)
- [x] Create key management
- [x] Implement encryption verification
- [x] Add encryption monitoring
- [x] Write encryption tests
- [x] Create encryption documentation
