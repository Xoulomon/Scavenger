# Incentive Implementation - Quick Reference

## Data Structure

```rust
pub struct Incentive {
    pub id: u64,                    // Unique identifier
    pub waste_type: WasteType,      // Applicable waste type
    pub reward: u128,               // Tokens per kg
    pub max_waste_amount: u128,     // Max eligible grams
    pub rewarder: Address,          // Manufacturer address
    pub is_active: bool,            // Active status
    pub created_at: u64,            // Creation timestamp
}
```

## Public Functions

### Creation
```rust
// Create new incentive (manufacturers only)
create_incentive(env, waste_type, reward, max_waste_amount, rewarder) -> Incentive
```

### Queries
```rust
// Get incentive by ID
get_incentive_by_id(env, incentive_id) -> Option<Incentive>

// Check if incentive exists
incentive_exists(env, incentive_id) -> bool

// Get incentives for waste type
get_incentives_by_waste_type(env, waste_type) -> Vec<Incentive>

// Get all active incentives
get_active_incentives(env) -> Vec<Incentive>
```

### Updates
```rust
// Update active status (rewarder only)
update_incentive_status(env, incentive_id, is_active) -> Incentive
```

### Calculations
```rust
// Calculate reward for waste amount
calculate_incentive_reward(env, incentive_id, waste_amount) -> u128
```

## Usage Examples

### Create Incentive
```rust
// Register as manufacturer
client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

// Create incentive
let incentive = client.create_incentive(
    &WasteType::Plastic,
    &100,      // 100 tokens per kg
    &10000,    // Max 10kg
    &manufacturer,
);
```

### Calculate Reward
```rust
// For 5kg of plastic
let reward = client.calculate_incentive_reward(&incentive.id, &5000);
// Returns: 500 tokens (5000g * 100 / 1000)

// For 15kg (exceeds max)
let reward = client.calculate_incentive_reward(&incentive.id, &15000);
// Returns: 1000 tokens (capped at 10000g * 100 / 1000)
```

### Manage Status
```rust
// Deactivate
client.update_incentive_status(&incentive.id, &false);

// Reactivate
client.update_incentive_status(&incentive.id, &true);
```

### Query Incentives
```rust
// Get all plastic incentives
let incentives = client.get_incentives_by_waste_type(&WasteType::Plastic);

// Get active incentives
let active = client.get_active_incentives();

// Check existence
if client.incentive_exists(&id) {
    let incentive = client.get_incentive_by_id(&id).unwrap();
}
```

## Reward Calculation Formula

```
eligible_amount = min(waste_amount, max_waste_amount)
reward = (eligible_amount * reward_per_kg) / 1000
```

### Examples

| Incentive | Waste Amount | Eligible | Calculation | Reward |
|-----------|--------------|----------|-------------|--------|
| 100/kg, max 10kg | 5kg (5000g) | 5000g | 5000 * 100 / 1000 | 500 |
| 100/kg, max 10kg | 15kg (15000g) | 10000g | 10000 * 100 / 1000 | 1000 |
| 200/kg, max 5kg (inactive) | 3kg (3000g) | N/A | N/A | 0 |
| 100/kg, max 10kg | 1g | 1g | 1 * 100 / 1000 | 0 |

## Validation Rules

### Creation
- ✅ Rewarder must be registered manufacturer
- ✅ Reward must be > 0
- ✅ Max waste amount must be > 0
- ✅ Requires rewarder authentication

### Status Update
- ✅ Requires rewarder authentication
- ✅ Incentive must exist

### Reward Calculation
- ✅ Returns 0 if inactive
- ✅ Caps at max_waste_amount
- ✅ Uses checked arithmetic

## Error Messages

```rust
"Rewarder not registered"
"Only manufacturers can create incentives"
"Reward must be greater than zero"
"Max waste amount must be greater than zero"
"Incentive not found"
"Overflow in reward calculation"
```

## Common Patterns

### Find Best Incentive
```rust
let incentives = client.get_incentives_by_waste_type(&waste_type);
let mut best_reward = 0u128;
let mut best_id = 0u64;

for incentive in incentives.iter() {
    let reward = client.calculate_incentive_reward(&incentive.id, &amount);
    if reward > best_reward {
        best_reward = reward;
        best_id = incentive.id;
    }
}
```

### Check Multiple Waste Types
```rust
let waste_types = [
    WasteType::Paper,
    WasteType::Plastic,
    WasteType::Metal,
];

for waste_type in waste_types.iter() {
    let incentives = client.get_incentives_by_waste_type(waste_type);
    // Process incentives
}
```

### Incentive-Based Submission
```rust
// 1. Check available incentives
let incentives = client.get_active_incentives();

// 2. Calculate potential rewards
let mut rewards = Vec::new();
for incentive in incentives.iter() {
    if incentive.waste_type == material_type {
        let reward = client.calculate_incentive_reward(&incentive.id, &amount);
        rewards.push((incentive.id, reward));
    }
}

// 3. Submit material
let material = client.submit_material(&waste_type, &amount, &user, &desc);

// 4. Claim best reward (external logic)
```

## Storage Keys

```rust
("incentive_count",)           -> u64
("incentive", incentive_id)    -> Incentive
```

## Testing

### Run All Tests
```bash
cd stellar-contract
cargo test --lib
```

### Run Incentive Tests
```bash
cargo test test_create_incentive
cargo test test_calculate_incentive_reward
cargo test test_incentive
```

## Performance Tips

1. **Cache Active Incentives** - Query once, use multiple times
2. **Batch Calculations** - Calculate rewards for multiple incentives together
3. **Filter Early** - Use waste_type filtering before detailed checks
4. **Direct Lookups** - Use ID-based queries when possible

## Security Checklist

- ✅ Only manufacturers can create incentives
- ✅ Only rewarders can update their incentives
- ✅ Reward must be non-zero
- ✅ Max waste amount must be non-zero
- ✅ Inactive incentives return 0 rewards
- ✅ Overflow protection on calculations
- ✅ Deterministic storage and serialization

## Integration Checklist

- [ ] Register manufacturer accounts
- [ ] Create incentives for target waste types
- [ ] Display active incentives to users
- [ ] Calculate rewards before submission
- [ ] Handle inactive incentive transitions
- [ ] Implement reward distribution logic
- [ ] Monitor incentive performance
- [ ] Update status when budget exhausted

## Documentation Links

- **Full Implementation Guide:** `docs/INCENTIVE_IMPLEMENTATION.md`
- **Changes Summary:** `docs/INCENTIVE_CHANGES_SUMMARY.md`
- **Completion Report:** `INCENTIVE_IMPLEMENTATION_COMPLETE.md`
