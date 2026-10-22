# Type Design Guide

_Issue #815 — Scavngr Soroban Contract_

## Principles

1. **Minimise XDR bytes** — every field adds storage rent; prefer `u32`/`u64`
   over `u128`/`i128` where the range permits.
2. **Pack booleans** — four `bool` fields each serialise as a `u32` discriminant
   (4 bytes each).  Use `PackedFlags` to store them in a single `u32`.
3. **Pack coordinates** — two `i128` fields (32 bytes) become one `u64` with
   `CompressedCoords` (8 bytes, lossless).
4. **Avoid `String` for enumerations** — use `#[contracttype]` enums instead;
   they serialise to a single 4-byte discriminant.
5. **Use `Option<T>` sparingly** — wrap only when truly optional; every
   `Option<Address>` still occupies 36 bytes on the "Some" path.

---

## Serialised sizes (`type_utils::TypeSizes`)

| Type | Bytes |
|------|-------|
| `bool` (as XDR) | 4 |
| `u32` / `i32` | 4 |
| `u64` / `i64` | 8 |
| `u128` / `i128` | 16 |
| `Address` | 36 |
| `Symbol` (short) | 8 |
| `String(n)` | 4 + n |
| `Vec<T>(k)` | 4 + k × sizeof(T) |

Use `TypeSizes::string(len)` and `TypeSizes::vec(elem_size, count)` to estimate
a struct's serialised size before storing it.

---

## PackedFlags

```rust
use crate::type_utils::PackedFlags;

// Build from individual booleans
let flags = PackedFlags::new(is_active, is_frozen, is_confirmed, is_contaminated);

// Read
if flags.is_active() { ... }

// Mutate
flags.set_frozen(true);

// Serialise / deserialise (store as u32)
let raw: u32 = flags.as_u32();
let flags = PackedFlags::from_u32(raw);
```

**Savings**: 4 × 4 bytes = 16 bytes → 4 bytes.  On a chain with 10 000 waste
items the difference is ~120 KB of storage.

---

## CompressedCoords

```rust
use crate::type_utils::CompressedCoords;

// Pack lat/lon (microdegrees, e.g. 52_520_000 = 52.52°)
let coords = CompressedCoords::pack(latitude, longitude);

// Unpack
let (lat, lon) = coords.unpack();

// Store as u64
let raw: u64 = coords.0;
let coords = CompressedCoords(raw);
```

**Savings**: 2 × 16 bytes = 32 bytes → 8 bytes.

---

## Type validation helpers

All helpers live in `type_utils` and return `bool` for cheap guard checks:

```rust
use crate::type_utils::{
    is_valid_role, is_valid_waste_type, is_valid_processing_status,
    is_valid_certification_level, is_valid_percentage,
    is_valid_contamination_level, is_valid_composition,
};

// Example — guard before unsafe transmute in from_u32
if !is_valid_waste_type(raw_value) {
    panic!("invalid waste type discriminant");
}
```

---

## Field-type decisions

### `waste_id: u128` vs `u64`

The contract supports up to ~1.8 × 10¹⁹ waste items with `u64`.  `u128` is
used because Soroban storage keys are `u128`, but if the ID counter never
exceeds `u64::MAX` (practically impossible) it could be narrowed to save 8
bytes per waste entry.  **Leave as `u128` for now.**

### `weight: u128` vs `u64`

Maximum weight is validated to 1 000 000 kg = 10⁹ grams, which fits in `u32`
(max ~4.3 × 10⁹).  The field is `u128` for future-proofing and to support
batch weights.  **Consider narrowing to `u64` if storage fees become a concern.**

### Coordinates: `i128` → `CompressedCoords`

Switch new code to `CompressedCoords` for new structs; keep `i128` on `Waste`
for backward compatibility until a migration window.

---

## Benchmarking

```bash
cd stellar-contract
cargo bench --bench contract_benchmarks
```

Results are stored in `docs/archive/stellar-contract/BENCHMARK_RESULTS.md`.
