# Scavenger Contract - Configuration Storage

This contract implements configuration storage for the Scavenger application with admin-controlled updates and validation.

## Features

### Storage Components

1. **Scavenger Token Address** - Address of the token contract used in the scavenger system
2. **Charity Contract Address** - Address of the charity contract for donations
3. **Collector Percentage** - Percentage allocated to collectors (0-100)
4. **Owner Percentage** - Percentage allocated to owners (0-100)
5. **Total Tokens Earned** - Running total of tokens earned through the system
6. **Admin Address** - Address with administrative privileges

### Admin Functions

All configuration updates require admin authentication:

- `update_token_address()` - Update the scavenger token address
- `update_charity_address()` - Update the charity contract address
- `update_collector_percentage()` - Update collector percentage (validates total ≤ 100)
- `update_owner_percentage()` - Update owner percentage (validates total ≤ 100)
- `update_percentages()` - Update both percentages atomically (validates total ≤ 100)
- `transfer_admin()` - Transfer admin rights to a new address

### Read Functions

Public read-only functions to query configuration:

- `get_admin()` - Get current admin address
- `get_token_address()` - Get scavenger token address
- `get_charity_address()` - Get charity contract address
- `get_collector_percentage()` - Get collector percentage
- `get_owner_percentage()` - Get owner percentage
- `get_total_earned()` - Get total tokens earned

## Validation Rules

1. **Percentage Validation**: The sum of collector_percentage + owner_percentage must not exceed 100
2. **Admin Authentication**: All update functions require authentication from the current admin
3. **Initialization**: All configuration values must be set during contract initialization

## Usage Example

```rust
// Initialize contract
let admin = Address::from_string("GADMIN...");
let token = Address::from_string("GTOKEN...");
let charity = Address::from_string("GCHARITY...");

client.__constructor(
    &admin,
    &token,
    &charity,
    30,  // collector percentage
    20   // owner percentage
);

// Update configuration (admin only)
client.update_percentages(&admin, 35, 25);

// Read configuration (public)
let collector_pct = client.get_collector_percentage();
let owner_pct = client.get_owner_percentage();
```

## Testing

The contract includes comprehensive tests covering:

- ✅ Initialization with valid parameters
- ✅ Initialization validation (rejects invalid percentages)
- ✅ Admin-only access control
- ✅ Configuration persistence
- ✅ Percentage validation on updates
- ✅ Admin transfer functionality

Run tests with:
```bash
cargo test -p scavenger
```

## Architecture

### Storage Layer (`storage.rs`)
- Encapsulates all storage operations
- Uses Soroban SDK's instance storage
- Provides type-safe getters and setters

### Contract Layer (`contract.rs`)
- Implements business logic
- Enforces access control
- Validates input parameters
- Exposes public API

### Test Layer (`test.rs`)
- Unit tests for all functionality
- Tests both success and failure cases
- Validates access control and data persistence

## Acceptance Criteria

✅ **Configuration persists correctly** - All values stored in instance storage persist across calls

✅ **Only admin can update** - All update functions require admin authentication via `require_auth()`

✅ **Percentages validate correctly** - Sum of percentages validated on initialization and all updates

## Future Enhancements

Potential additions for future iterations:
- Events/logging for configuration changes
- Multi-sig admin support
- Time-locked configuration changes
- Configuration change history
