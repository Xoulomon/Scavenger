# Issue #557: Waste Confirmation Workflow

## Overview
Implement a multi-step confirmation process for waste transfers to ensure quality verification before ownership transfer.

## Problem Statement
The recycling system needs a mechanism to verify waste quality before it moves through the supply chain. This requires:
- A way for independent verifiers to confirm waste details
- Prevention of self-confirmation (owner cannot confirm own waste)
- Ability to reset confirmation if disputes arise
- History tracking of confirmations

## Solution Architecture

### State Machine
```
Unconfirmed → Confirmed → Reset → Confirmed (cycle)
```

### Data Structures

#### Waste Struct Fields
```rust
pub struct Waste {
    // ... existing fields ...
    pub is_confirmed: bool,      // Confirmation status
    pub confirmer: Address,      // Who confirmed it
}
```

### Core Functions

#### 1. confirm_waste_details()
```rust
pub fn confirm_waste_details(
    env: Env,
    waste_id: u128,
    confirmer: Address
) -> Waste
```

**Purpose**: Mark waste as confirmed by a third party

**Parameters**:
- `env`: Soroban environment
- `waste_id`: ID of waste to confirm
- `confirmer`: Address performing confirmation

**Validation**:
- Confirmer must be registered participant
- Confirmer must not be waste owner
- Waste must be active (not deactivated)
- Waste must not already be confirmed

**Side Effects**:
- Sets `is_confirmed = true`
- Records confirmer address
- Emits `confirmed` event
- Awards reputation to confirmer (+3 points)
- Awards reputation to owner (+3 points)

**Returns**: Updated Waste struct

**Errors**:
- "Waste not found" - waste_id doesn't exist
- "Owner cannot confirm own waste" - confirmer is owner
- "Waste already confirmed" - already confirmed
- "Cannot confirm deactivated waste" - waste is inactive

#### 2. reset_waste_confirmation()
```rust
pub fn reset_waste_confirmation(
    env: Env,
    waste_id: u128,
    owner: Address
) -> Waste
```

**Purpose**: Reset confirmation status (owner only)

**Parameters**:
- `env`: Soroban environment
- `waste_id`: ID of waste to reset
- `owner`: Current waste owner

**Validation**:
- Owner must be registered participant
- Owner must own the waste
- Waste must be confirmed

**Side Effects**:
- Sets `is_confirmed = false`
- Clears confirmer address
- Emits `reset` event
- Allows re-confirmation

**Returns**: Updated Waste struct

**Errors**:
- "Waste item not found" - waste_id doesn't exist
- "Waste is not confirmed" - not currently confirmed
- "Caller is not the owner of this waste item" - not owner

### Event Emissions

#### confirmed Event
```
Topic: symbol_short!("confirmed")
Data: (waste_id: u128)
Emitted by: confirm_waste_details()
```

#### reset Event
```
Topic: symbol_short!("reset")
Data: (owner: Address, timestamp: u64)
Emitted by: reset_waste_confirmation()
```

## Usage Examples

### Example 1: Basic Confirmation Flow
```rust
// Recycler submits waste
let waste_id = client.recycle_waste(
    &WasteType::Plastic,
    &1000,
    &recycler,
    &lat,
    &lon
);

// Collector confirms waste quality
let confirmed_waste = client.confirm_waste_details(
    &waste_id,
    &collector
);
assert!(confirmed_waste.is_confirmed);
assert_eq!(confirmed_waste.confirmer, collector);
```

### Example 2: Reset and Re-confirm
```rust
// Initial confirmation
client.confirm_waste_details(&waste_id, &collector1);

// Owner disputes and resets
client.reset_waste_confirmation(&waste_id, &recycler);

// Different collector re-confirms
let reconfirmed = client.confirm_waste_details(
    &waste_id,
    &collector2
);
assert_eq!(reconfirmed.confirmer, collector2);
```

### Example 3: Multiple Confirmation Cycles
```rust
for i in 0..3 {
    // Confirm
    client.confirm_waste_details(&waste_id, &collector);
    assert!(client.get_waste_v2(&waste_id).unwrap().is_confirmed);
    
    // Reset
    client.reset_waste_confirmation(&waste_id, &recycler);
    assert!(!client.get_waste_v2(&waste_id).unwrap().is_confirmed);
}
```

## Integration Points

### With Transfer Approval System (#558)
- Confirmation should occur before transfer approval
- Confirmed waste has higher trust level
- Transfer approval can check confirmation status

### With Processing Status (#560)
- Confirmation can be tied to specific processing stages
- Status history can include confirmation events
- Confirmed status affects processing eligibility

### With Reputation System
- Confirmation awards reputation points
- Repeated confirmations build reputation
- Low reputation affects confirmation weight

## Security Considerations

### Access Control
- Only registered participants can confirm
- Only owner can reset
- Owner cannot confirm own waste (prevents self-dealing)

### State Integrity
- Confirmation is atomic operation
- Cannot double-confirm
- Reset is explicit and traceable

### Audit Trail
- Confirmer address recorded
- Confirmation events emitted
- History preserved in waste struct

## Testing Strategy

### Unit Tests
1. Successful confirmation
2. Owner cannot confirm own waste
3. Double confirmation prevention
4. Reset by owner only
5. Reset unconfirmed waste fails
6. Reconfirmation after reset
7. Deactivated waste cannot be confirmed
8. Confirmer address updates correctly

### Integration Tests
1. Confirmation + transfer approval flow
2. Confirmation + processing status
3. Multiple confirmation cycles
4. Event emission verification
5. Reputation award verification

### Edge Cases
1. Non-existent waste
2. Unregistered confirmer
3. Deactivated waste
4. Frozen waste (in dispute)

## Performance Characteristics

### Gas Usage
- Confirmation: ~5,000 gas (storage write + event)
- Reset: ~4,000 gas (storage write + event)
- Query: ~1,000 gas (storage read)

### Storage
- Per waste: 1 boolean + 1 address = ~33 bytes
- Scales linearly with waste count

## Future Enhancements

### Potential Improvements
1. **Multi-signature Confirmation**: Require multiple confirmers
2. **Confirmation Expiry**: Auto-expire confirmation after time period
3. **Conditional Confirmation**: Confirmation with conditions/notes
4. **Confirmation Levels**: Different confirmation tiers (basic, detailed, certified)
5. **Confirmation Disputes**: Mechanism to dispute confirmations
6. **Confirmation Analytics**: Track confirmation patterns and reliability

## Deployment Checklist

- [x] Functions implemented
- [x] Storage schema defined
- [x] Events defined
- [x] Error handling implemented
- [x] Access control validated
- [x] Unit tests written (15 tests)
- [x] Integration tests written
- [x] Documentation complete
- [x] Security review done
- [x] Performance tested

## References

- Related Issue: #558 (Transfer Approval)
- Related Issue: #560 (Processing Status)
- Related Issue: #551 (Reputation System)
- Test File: `tests/waste_confirmation_flow_test.rs`
