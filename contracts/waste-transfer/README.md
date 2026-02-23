# Waste Transfer Smart Contract

A Soroban smart contract for tracking waste transfers in the supply chain on the Stellar blockchain.

## Overview

This contract enables transparent tracking of waste materials as they move through the supply chain. Each transfer is recorded with complete details including sender, receiver, timestamp, location coordinates, and notes.

## Features

- **Transfer Recording**: Record waste transfers with full metadata
- **Transfer History**: Retrieve complete transfer history for any waste item
- **Location Tracking**: Store precise GPS coordinates (latitude/longitude)
- **Timestamp Accuracy**: Automatic timestamp capture from ledger
- **Authorization**: Requires sender authentication for each transfer

## Data Structure

### WasteTransfer Struct

```rust
pub struct WasteTransfer {
    pub waste_id: u128,      // Unique identifier for the waste item
    pub from: Address,       // Address transferring the waste
    pub to: Address,         // Address receiving the waste
    pub timestamp: u64,      // Unix timestamp (seconds since epoch)
    pub latitude: i128,      // Latitude (scaled by 10^7)
    pub longitude: i128,     // Longitude (scaled by 10^7)
    pub notes: Symbol,       // Additional notes (e.g., "PICKUP", "PROCESS")
}
```

### Location Coordinates

Coordinates are stored as integers scaled by 10^7 for precision:
- Example: 37.7749° → 377749000
- Example: -122.4194° → -1224194000

## Contract Methods

### record_transfer

Records a new waste transfer in the supply chain.

```rust
pub fn record_transfer(
    env: Env,
    waste_id: u128,
    from: Address,
    to: Address,
    latitude: i128,
    longitude: i128,
    notes: Symbol,
)
```

**Parameters:**
- `waste_id`: Unique identifier for the waste item
- `from`: Address of the sender (requires authentication)
- `to`: Address of the receiver
- `latitude`: Latitude coordinate (scaled by 10^7)
- `longitude`: Longitude coordinate (scaled by 10^7)
- `notes`: Short description or status (max 32 chars)

**Authorization:** Requires `from` address authentication

### get_transfers

Retrieves all transfers for a specific waste item.

```rust
pub fn get_transfers(env: Env, waste_id: u128) -> Vec<WasteTransfer>
```

**Parameters:**
- `waste_id`: Unique identifier for the waste item

**Returns:** Vector of all transfers for the waste item

### get_latest_transfer

Retrieves the most recent transfer for a waste item.

```rust
pub fn get_latest_transfer(env: Env, waste_id: u128) -> Option<WasteTransfer>
```

**Parameters:**
- `waste_id`: Unique identifier for the waste item

**Returns:** The latest transfer, or None if no transfers exist

## Storage

The contract uses persistent storage with the following structure:
- Key: `("transfers", waste_id)`
- Value: `Vec<WasteTransfer>`

## Building

```bash
cargo build --manifest-path contracts/waste-transfer/Cargo.toml --release --target wasm32-unknown-unknown
```

## Testing

```bash
cargo test --manifest-path contracts/waste-transfer/Cargo.toml
```

## Test Coverage

The contract includes comprehensive tests:
- ✅ Record and retrieve transfers
- ✅ Multiple transfers for same waste_id
- ✅ Latest transfer retrieval
- ✅ Timestamp accuracy
- ✅ Location data preservation
- ✅ Separate storage for different waste_ids

## Usage Example

```rust
// Record a transfer
client.record_transfer(
    &12345,                    // waste_id
    &sender_address,           // from
    &receiver_address,         // to
    &377749000,               // latitude (37.7749°)
    &-1224194000,             // longitude (-122.4194°)
    &symbol_short!("PICKUP")  // notes
);

// Get all transfers
let transfers = client.get_transfers(&12345);

// Get latest transfer
let latest = client.get_latest_transfer(&12345);
```

## Acceptance Criteria

✅ Struct stores transfer history correctly  
✅ Timestamps are accurate (captured from ledger)  
✅ Location data is preserved (i128 precision)  
✅ Implements Soroban storage traits (contracttype)  
✅ All fields properly defined and accessible

## License

Apache-2.0
