# Waste Management Smart Contract

A Soroban smart contract for tracking and managing waste recycling on the Stellar blockchain.

## Overview

This contract provides a robust system for recording waste entries with comprehensive tracking capabilities including location data, ownership, and confirmation status.

## Waste Struct

The main `Waste` struct contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `waste_id` | `u128` | Unique identifier for the waste entry |
| `waste_type` | `WasteType` | Type of waste (Plastic, Glass, Metal, etc.) |
| `weight` | `u128` | Weight of the waste in grams |
| `current_owner` | `Address` | Current owner of the waste |
| `latitude` | `i128` | Latitude coordinate (multiplied by 10^7 for precision) |
| `longitude` | `i128` | Longitude coordinate (multiplied by 10^7 for precision) |
| `recycled_timestamp` | `u64` | Timestamp when the waste was recycled |
| `is_active` | `bool` | Whether the waste entry is active |
| `is_confirmed` | `bool` | Whether the waste has been confirmed |
| `confirmer` | `Address` | Address of the confirmer |

## Waste Types

The contract supports the following waste types:

- `Plastic`
- `Glass`
- `Metal`
- `Paper`
- `Organic`
- `Electronic`
- `Hazardous`
- `Mixed`

## Builder Pattern

The contract implements a builder pattern for convenient waste creation:

```rust
let waste = WasteBuilder::new()
    .waste_id(1)
    .waste_type(WasteType::Plastic)
    .weight(1000)
    .current_owner(owner)
    .latitude(404850000)  // 40.4850000 * 10^7
    .longitude(-740600000) // -74.0600000 * 10^7
    .recycled_timestamp(timestamp)
    .is_active(true)
    .is_confirmed(false)
    .confirmer(confirmer)
    .build();
```

## Contract Methods

### `create_waste`

Creates a new waste entry with the specified parameters.

**Parameters:**
- `waste_id`: Unique identifier
- `waste_type`: Type of waste
- `weight`: Weight in grams
- `current_owner`: Owner address (requires auth)
- `latitude`: Latitude coordinate
- `longitude`: Longitude coordinate

**Returns:** `Waste` struct

## Location Coordinates

Latitude and longitude values are stored as `i128` integers multiplied by 10^7 for precision:
- Example: 40.4850000° → 404850000
- Example: -74.0600000° → -740600000

## Building

```bash
cargo build --manifest-path contracts/waste-management/Cargo.toml --release --target wasm32-unknown-unknown
```

## Testing

```bash
cargo test --manifest-path contracts/waste-management/Cargo.toml
```

## Acceptance Criteria

✅ Struct compiles and can be stored  
✅ All fields are properly typed  
✅ Builder pattern works correctly  
✅ All tests pass  
✅ Contract can be built for WASM deployment
