# Maximum Weight Validation Guide

## Overview

The maximum weight validation system ensures that all waste submissions comply with configured weight limits. This prevents system abuse, ensures data integrity, and maintains reasonable bounds on waste quantities.

## Configuration

### Current Limits
- **Maximum Weight**: 1,000,000,000 grams (1,000 metric tons)
- **Minimum Weight**: Configurable (default: 1 gram)
- **Unit**: All weights are in grams

### Modifying Limits

To change the maximum weight limit, edit `stellar-contract/src/lib.rs`:

```rust
const MAX_WASTE_WEIGHT: u128 = 1_000_000_000; // Change this value
```

Common weight conversions:
- 1 kilogram = 1,000 grams
- 1 metric ton = 1,000,000 grams
- 1 pound = 453.592 grams

## Validation Points

### 1. Waste Recycling (`recycle_waste`)
Validates weight when a recycler submits waste:

```rust
pub fn recycle_waste(
    env: Env,
    waste_type: WasteType,
    weight: u128,  // Must be ≤ MAX_WASTE_WEIGHT
    recycler: Address,
    latitude: i128,
    longitude: i128,
) -> u128
```

**Validation Rules:**
- Weight ≥ minimum weight
- Weight ≤ maximum weight (1,000,000,000 grams)

**Error:** "Waste weight exceeds maximum allowed"

### 2. Material Submission (`submit_material`)
Validates weight when submitting individual materials:

```rust
pub fn submit_material(
    env: Env,
    waste_type: WasteType,
    weight: u64,  // Converted to u128, must be ≤ MAX_WASTE_WEIGHT
    submitter: Address,
    description: String,
) -> Material
```

**Validation Rules:**
- Weight ≥ minimum weight
- Weight ≤ maximum weight (1,000,000,000 grams)

**Error:** "Waste weight exceeds maximum allowed"

### 3. Batch Material Submission (`submit_materials_batch`)
Validates each material in a batch:

```rust
pub fn submit_materials_batch(
    env: Env,
    submitter: Address,
    materials: Vec<(WasteType, u64, String)>,
) -> Vec<Material>
```

**Validation Rules:**
- Each material's weight ≥ minimum weight
- Each material's weight ≤ maximum weight
- Batch fails if any item exceeds limits

**Error:** "Waste weight exceeds maximum allowed"

## Implementation Details

### Weight Validation Logic

```rust
// Check minimum weight
let min_weight = Self::get_min_weight(&env);
if weight < min_weight {
    panic!("Waste weight below minimum allowed");
}

// Check maximum weight
if weight > MAX_WASTE_WEIGHT {
    panic!("Waste weight exceeds maximum allowed");
}
```

### Storage
- Weights are stored as `u128` in the Waste struct
- No additional storage overhead for validation
- Validation occurs at submission time

### Performance
- **Validation Time**: O(1) - Simple numeric comparison
- **Storage Impact**: Negligible
- **Gas Cost**: Minimal (single comparison operation)

## Testing

### Test Coverage
Tests are located in `stellar-contract/tests/max_weight_validation_test.rs`:

1. **At Maximum Limit**: Weight = 1,000,000,000 grams (succeeds)
2. **Above Maximum Limit**: Weight > 1,000,000,000 grams (fails)
3. **Below Maximum Limit**: Weight < 1,000,000,000 grams (succeeds)
4. **Batch Operations**: Multiple items with various weights

### Running Tests
```bash
cd stellar-contract
cargo test max_weight_validation_test
```

### Test Examples

```rust
#[test]
fn test_recycle_waste_at_max_weight_succeeds() {
    let env = Env::default();
    let (client, recycler) = setup(&env);
    client.recycle_waste(&WasteType::Plastic, &MAX_WASTE_WEIGHT, &recycler, &0, &0);
}

#[test]
#[should_panic(expected = "Waste weight exceeds maximum allowed")]
fn test_recycle_waste_above_max_weight_rejected() {
    let env = Env::default();
    let (client, recycler) = setup(&env);
    client.recycle_waste(
        &WasteType::Plastic,
        &(MAX_WASTE_WEIGHT + 1),
        &recycler,
        &0,
        &0,
    );
}
```

## Error Handling

### Error Message
When weight validation fails:
```
"Waste weight exceeds maximum allowed"
```

### Transaction Behavior
- Transaction is rejected
- No state changes occur
- Participant can retry with valid weight

### Client-Side Validation
Recommended client-side validation before submission:

```typescript
const MAX_WASTE_WEIGHT = 1_000_000_000;

function validateWeight(weight: number): boolean {
    if (weight < 1) {
        console.error("Weight must be at least 1 gram");
        return false;
    }
    if (weight > MAX_WASTE_WEIGHT) {
        console.error(`Weight exceeds maximum of ${MAX_WASTE_WEIGHT} grams`);
        return false;
    }
    return true;
}
```

## Use Cases

### 1. Preventing System Abuse
Prevents malicious actors from submitting unrealistic quantities:
- Prevents storage bloat
- Prevents calculation overflow
- Maintains system stability

### 2. Data Integrity
Ensures weight values are within reasonable bounds:
- Catches data entry errors
- Prevents invalid calculations
- Maintains data consistency

### 3. Business Rules
Enforces organizational policies:
- Limits per-submission quantities
- Prevents single-submission dominance
- Encourages distributed submissions

### 4. Compliance
Meets regulatory requirements:
- Tracks waste quantities accurately
- Prevents unrealistic reporting
- Maintains audit trail

## Examples

### Valid Submissions
```rust
// 100 kg of plastic
client.recycle_waste(&WasteType::Plastic, &100_000u128, &recycler, &0, &0);

// 500 metric tons of metal
client.recycle_waste(&WasteType::Metal, &500_000_000u128, &recycler, &0, &0);

// 1,000 metric tons (at limit)
client.recycle_waste(&WasteType::Paper, &1_000_000_000u128, &recycler, &0, &0);
```

### Invalid Submissions
```rust
// 1,000.001 metric tons (exceeds limit)
client.recycle_waste(&WasteType::Plastic, &1_000_000_001u128, &recycler, &0, &0);
// Error: "Waste weight exceeds maximum allowed"

// 0 grams (below minimum)
client.recycle_waste(&WasteType::Plastic, &0u128, &recycler, &0, &0);
// Error: "Waste weight below minimum allowed"
```

## Monitoring

### Metrics to Track
1. **Average Submission Weight**: Monitor typical submission sizes
2. **Maximum Submissions**: Track submissions near the limit
3. **Rejected Submissions**: Monitor validation failures
4. **Weight Distribution**: Analyze weight distribution across waste types

### Alerts
Consider setting up alerts for:
- Submissions exceeding 80% of maximum
- Unusual weight patterns
- Repeated validation failures

## Future Enhancements

### 1. Dynamic Limits
Allow different limits per waste type:
```rust
const MAX_WEIGHT_PLASTIC: u128 = 500_000_000;
const MAX_WEIGHT_METAL: u128 = 1_000_000_000;
const MAX_WEIGHT_PAPER: u128 = 2_000_000_000;
```

### 2. Role-Based Limits
Different limits for different participant roles:
```rust
match role {
    ParticipantRole::Recycler => 500_000_000,
    ParticipantRole::Collector => 1_000_000_000,
    ParticipantRole::Manufacturer => 2_000_000_000,
}
```

### 3. Time-Based Limits
Adjust limits based on time periods:
```rust
// Daily limit: 100 metric tons
// Weekly limit: 500 metric tons
// Monthly limit: 2,000 metric tons
```

### 4. Adaptive Limits
Adjust limits based on system load:
```rust
// Reduce limits during high load
// Increase limits during low load
```

## Troubleshooting

### Issue: "Waste weight exceeds maximum allowed"

**Cause**: Submitted weight > 1,000,000,000 grams

**Solution**:
1. Verify the weight value
2. Convert to grams if using different units
3. Split large submissions into multiple smaller ones
4. Contact administrator if limit needs adjustment

### Issue: Batch submission partially fails

**Cause**: One or more items in batch exceed weight limit

**Solution**:
1. Review all items in batch
2. Remove or reduce weight of items exceeding limit
3. Resubmit batch with valid weights

## References

- **Implementation**: `stellar-contract/src/lib.rs`
- **Tests**: `stellar-contract/tests/max_weight_validation_test.rs`
- **Related Issues**: #562
- **Related Documentation**: `archive/WASTE_TAGS_AND_MAX_WEIGHT_IMPLEMENTATION.md`
