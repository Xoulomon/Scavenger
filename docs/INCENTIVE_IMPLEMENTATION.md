# Incentive Data Structure Implementation

## Overview

This document describes the comprehensive Incentive data structure implementation for the Scavenger smart contract. The implementation provides manufacturer incentive programs for recycling specific waste types, with deterministic reward calculations, overflow protection, and proper access control.

## Data Structure

### Incentive Struct

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Incentive {
    pub id: u64,                    // Unique incentive identifier
    pub waste_type: WasteType,      // Type of waste this incentive applies to
    pub reward: u128,               // Reward amount per unit (tokens per kg)
    pub max_waste_amount: u128,     // Maximum waste amount eligible (in grams)
    pub rewarder: Address,          // Manufacturer offering the incentive
    pub is_active: bool,            // Whether incentive is currently active
    pub created_at: u64,            // Creation timestamp
}
```

### WasteType Enum

The existing `WasteType` enum is used for type-safe waste categorization:

```rust
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WasteType {
    Paper = 0,
    PetPlastic = 1,
    Plastic = 2,
    Metal = 3,
    Glass = 4,
}
```

## Key Features

### 1. Deterministic Storage

- Uses Soroban's `#[contracttype]` for deterministic serialization
- Consistent storage layout across all contract invocations
- Keyed by incentive ID for efficient lookups
- Separate storage namespace from waste records
- Maintains storage integrity with proper type annotations

### 2. Access Control

**Manufacturer-Only Creation:**
- Only registered manufacturers can create incentives
- Validates participant role before allowing creation
- Requires authentication from the rewarder address

**Rewarder-Only Updates:**
- Only the incentive creator can update its status
- Authentication required for status changes
- Prevents unauthorized modifications

### 3. Input Validation

**Creation Validation:**
- Reward must be greater than zero
- Max waste amount must be greater than zero
- Rewarder must be a registered manufacturer
- All validations with clear error messages

**Prevents Invalid Configurations:**
- No zero-reward incentives
- No zero-capacity incentives
- No incentives from non-manufacturers

### 4. Reward Calculation

**Deterministic Calculation:**
```rust
// Formula: (eligible_amount * reward) / 1000
// Where eligible_amount is capped at max_waste_amount
```

**Features:**
- Caps waste amount at `max_waste_amount`
- Returns 0 for inactive incentives
- Uses checked arithmetic to prevent overflow
- Consistent results across all invocations

**Overflow Protection:**
- Uses `checked_mul()` for multiplication
- Uses `checked_div()` for division
- Panics with clear error on overflow
- Prevents silent wraparound bugs

### 5. Active/Inactive State Management

**Active Incentives:**
- Can distribute rewards
- Included in active incentive queries
- Default state for new incentives

**Inactive Incentives:**
- Return 0 rewards
- Excluded from active incentive queries
- Preserved in storage for historical records
- Can be reactivated by rewarder

## Contract Functions

### Creation Functions

#### `create_incentive`
```rust
pub fn create_incentive(
    env: Env,
    waste_type: WasteType,
    reward: u128,
    max_waste_amount: u128,
    rewarder: Address,
) -> Incentive
```
- Creates a new manufacturer incentive program
- Validates rewarder is a registered manufacturer
- Validates reward and max_waste_amount are non-zero
- Requires rewarder authentication
- Returns created incentive with unique ID

### Query Functions

#### `get_incentive_by_id`
```rust
pub fn get_incentive_by_id(
    env: Env,
    incentive_id: u64,
) -> Option<Incentive>
```
- Retrieves incentive by ID
- Returns `None` if not found
- No authentication required

#### `incentive_exists`
```rust
pub fn incentive_exists(
    env: Env,
    incentive_id: u64,
) -> bool
```
- Checks if incentive exists
- Returns boolean
- No authentication required

#### `get_incentives_by_waste_type`
```rust
pub fn get_incentives_by_waste_type(
    env: Env,
    waste_type: WasteType,
) -> Vec<Incentive>
```
- Returns all incentives for a specific waste type
- Includes both active and inactive incentives
- Returns empty vector if none found

#### `get_active_incentives`
```rust
pub fn get_active_incentives(
    env: Env,
) -> Vec<Incentive>
```
- Returns all currently active incentives
- Filters out inactive incentives
- Returns empty vector if none active

### Update Functions

#### `update_incentive_status`
```rust
pub fn update_incentive_status(
    env: Env,
    incentive_id: u64,
    is_active: bool,
) -> Incentive
```
- Updates incentive active status
- Requires rewarder authentication
- Can activate or deactivate
- Returns updated incentive

### Calculation Functions

#### `calculate_incentive_reward`
```rust
pub fn calculate_incentive_reward(
    env: Env,
    incentive_id: u64,
    waste_amount: u64,
) -> u128
```
- Calculates reward for given waste amount
- Caps amount at max_waste_amount
- Returns 0 for inactive incentives
- Uses checked arithmetic
- Deterministic results

### Internal Functions

#### `set_incentive`
```rust
fn set_incentive(
    env: &Env,
    incentive_id: u64,
    incentive: &Incentive,
)
```
- Internal helper for storing incentives
- Uses stable storage key format
- Ensures deterministic serialization

#### `get_incentive`
```rust
fn get_incentive(
    env: &Env,
    incentive_id: u64,
) -> Option<Incentive>
```
- Internal helper for retrieving incentives
- Returns None if not found
- Consistent with storage format

## Storage Layout

### Storage Keys

```rust
// Incentive counter
("incentive_count",) -> u64

// Individual incentive
("incentive", incentive_id) -> Incentive
```

### Key Properties

- Separate namespace from waste records
- No collision with existing storage
- Deterministic key generation
- Efficient lookup by ID

## Reward Calculation Details

### Formula

```
eligible_amount = min(waste_amount, max_waste_amount)
reward = (eligible_amount * reward_per_kg) / 1000
```

### Examples

**Example 1: Normal Case**
- Incentive: 100 tokens/kg, max 10kg
- Waste: 5kg (5000g)
- Calculation: (5000 * 100) / 1000 = 500 tokens

**Example 2: Capped Amount**
- Incentive: 100 tokens/kg, max 10kg
- Waste: 15kg (15000g)
- Eligible: 10kg (capped)
- Calculation: (10000 * 100) / 1000 = 1000 tokens

**Example 3: Inactive Incentive**
- Incentive: 200 tokens/kg, max 5kg (inactive)
- Waste: 3kg (3000g)
- Result: 0 tokens (inactive)

**Example 4: Small Amount**
- Incentive: 100 tokens/kg, max 10kg
- Waste: 1g
- Calculation: (1 * 100) / 1000 = 0 tokens (integer division)

## Security Considerations

### Authentication

- Incentive creation requires manufacturer authentication
- Status updates require rewarder authentication
- Validates participant role before creation
- Prevents unauthorized incentive management

### Input Validation

- Reward must be non-zero
- Max waste amount must be non-zero
- Rewarder must be registered manufacturer
- Clear panic messages for invalid inputs

### Overflow Protection

```rust
eligible_amount
    .checked_mul(incentive.reward)
    .and_then(|result| result.checked_div(1000))
    .expect("Overflow in reward calculation")
```

- All arithmetic uses checked operations
- Panics with descriptive error on overflow
- Prevents silent wraparound bugs
- Maintains calculation integrity

### State Validation

- Active status checked before reward distribution
- Inactive incentives return 0 rewards
- Status changes require authentication
- Prevents unauthorized reward distribution

### Storage Integrity

- Deterministic serialization via `#[contracttype]`
- Consistent storage keys
- No data corruption from concurrent access
- Proper type safety

## Testing

### Test Coverage

The implementation includes 18 comprehensive tests covering:

1. **Creation Tests**
   - `test_create_incentive` - Basic creation flow
   - `test_incentive_persistence` - Storage persistence
   - `test_create_incentive_non_manufacturer` - Role validation
   - `test_create_incentive_zero_reward` - Reward validation
   - `test_create_incentive_zero_max_waste` - Max waste validation

2. **Status Management Tests**
   - `test_update_incentive_status` - Status updates
   - `test_get_active_incentives` - Active filtering

3. **Reward Calculation Tests**
   - `test_calculate_incentive_reward_basic` - Normal calculation
   - `test_calculate_incentive_reward_capped` - Amount capping
   - `test_calculate_incentive_reward_inactive` - Inactive handling
   - `test_calculate_incentive_reward_edge_cases` - Edge cases
   - `test_incentive_reward_calculation_no_overflow` - Overflow protection

4. **Query Tests**
   - `test_incentive_exists` - Existence checks
   - `test_get_incentives_by_waste_type` - Waste type filtering
   - `test_get_active_incentives` - Active filtering

5. **Multi-Entity Tests**
   - `test_multiple_manufacturers_incentives` - Multiple manufacturers
   - `test_incentive_all_waste_types` - All waste types

6. **Storage Tests**
   - `test_incentive_storage_deterministic` - Deterministic storage

### Running Tests

```bash
cd stellar-contract
cargo test --lib
```

All tests pass with no regressions to existing functionality.

## Usage Examples

### Create an Incentive

```rust
// Register as manufacturer
client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

// Create incentive for plastic recycling
let incentive = client.create_incentive(
    &WasteType::Plastic,
    &100,      // 100 tokens per kg
    &10000,    // Max 10kg (10000g)
    &manufacturer,
);
```

### Calculate Rewards

```rust
// Calculate reward for 5kg of plastic
let reward = client.calculate_incentive_reward(&incentive.id, &5000);
// Returns: 500 tokens (5000g * 100 / 1000)
```

### Manage Incentive Status

```rust
// Deactivate incentive
client.update_incentive_status(&incentive.id, &false);

// Reactivate incentive
client.update_incentive_status(&incentive.id, &true);
```

### Query Incentives

```rust
// Get all plastic incentives
let plastic_incentives = client.get_incentives_by_waste_type(&WasteType::Plastic);

// Get all active incentives
let active = client.get_active_incentives();

// Check if incentive exists
if client.incentive_exists(&incentive_id) {
    let incentive = client.get_incentive_by_id(&incentive_id).unwrap();
}
```

## Integration Patterns

### Incentive-Based Recycling Flow

```rust
// 1. Manufacturer creates incentive
let incentive = client.create_incentive(
    &WasteType::Metal,
    &200,
    &5000,
    &manufacturer,
);

// 2. User submits matching waste
let material = client.submit_material(
    &WasteType::Metal,
    &3000,
    &user,
    &description,
);

// 3. Calculate potential reward
let reward = client.calculate_incentive_reward(&incentive.id, &material.weight);

// 4. Distribute reward (external logic)
// transfer_tokens(user, reward);
```

### Multiple Incentive Comparison

```rust
// Get all incentives for a waste type
let incentives = client.get_incentives_by_waste_type(&WasteType::Plastic);

// Find best incentive for given amount
let waste_amount = 5000u64;
let mut best_reward = 0u128;
let mut best_incentive_id = 0u64;

for incentive in incentives.iter() {
    let reward = client.calculate_incentive_reward(&incentive.id, &waste_amount);
    if reward > best_reward {
        best_reward = reward;
        best_incentive_id = incentive.id;
    }
}
```

## Performance Considerations

### Gas Optimization

- Single storage write per incentive creation
- Efficient ID-based lookups
- Minimal redundant reads
- Compact data types

### Storage Efficiency

- ~150 bytes per incentive
- Efficient serialization format
- No redundant data duplication
- Separate namespace prevents conflicts

### Query Optimization

- Direct ID lookups are O(1)
- Waste type filtering is O(n) where n = total incentives
- Active filtering is O(n) where n = total incentives
- Consider caching for frequently accessed incentives

## Error Handling

### Common Errors

```rust
// Rewarder not registered
panic!("Rewarder not registered")

// Not a manufacturer
panic!("Only manufacturers can create incentives")

// Invalid reward
panic!("Reward must be greater than zero")

// Invalid max waste
panic!("Max waste amount must be greater than zero")

// Incentive not found
panic!("Incentive not found")

// Overflow in calculation
panic!("Overflow in reward calculation")
```

## Migration Notes

### No Breaking Changes

The Incentive implementation:
- Uses separate storage namespace
- Does not modify existing structures
- Maintains backward compatibility
- No migration required for existing data

### New Storage Keys

```
("incentive_count",) -> u64
("incentive", id) -> Incentive
```

## Future Enhancements

Potential improvements:
1. Time-limited incentives (expiration dates)
2. Tiered reward structures
3. Incentive budgets and caps
4. Geographic restrictions
5. Participant-specific incentives
6. Batch incentive creation
7. Incentive analytics and reporting

## Best Practices

### For Manufacturers

1. **Set Realistic Rewards**
   - Consider market rates
   - Account for processing costs
   - Balance incentive with budget

2. **Monitor Incentive Performance**
   - Track reward distribution
   - Adjust max_waste_amount as needed
   - Deactivate when budget exhausted

3. **Use Appropriate Max Amounts**
   - Cap prevents excessive payouts
   - Align with processing capacity
   - Consider supply chain limits

### For Integrators

1. **Check Active Status**
   - Always verify is_active before showing to users
   - Filter inactive incentives in UI
   - Handle status changes gracefully

2. **Calculate Before Promising**
   - Calculate rewards before user submission
   - Show potential earnings upfront
   - Handle capping transparently

3. **Handle Multiple Incentives**
   - Show all applicable incentives
   - Let users choose best option
   - Consider automatic optimization

## Conclusion

The Incentive implementation provides a robust, secure, and efficient foundation for manufacturer incentive programs in the Scavenger ecosystem. It enforces proper access control, maintains accurate reward calculations, and ensures data integrity through deterministic storage and overflow protection.

## Documentation Links

- **Implementation Guide:** This document
- **Quick Reference:** `docs/INCENTIVE_QUICK_REFERENCE.md`
- **Changes Summary:** `docs/INCENTIVE_CHANGES_SUMMARY.md`
