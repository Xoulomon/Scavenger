# Issue #560: Waste Processing Status Tracking

## Overview
Track processing status of waste through the supply chain with comprehensive history tracking to enable visibility into waste lifecycle and processing progress.

## Problem Statement
The recycling system needs to:
- Track waste through different processing stages
- Maintain immutable history of status changes
- Enable status-based queries and filtering
- Prevent invalid status transitions
- Record who made each status change

## Solution Architecture

### State Machine
```
Collected → Sorted → Processed → Recycled → Manufactured
   ↓         ↓          ↓           ↓           ↓
  (1)       (2)        (3)         (4)         (5)
  
Forward-only progression (no backwards movement)
```

### Data Structures

#### ProcessingStatus Enum
```rust
pub enum ProcessingStatus {
    Collected = 0,      // Initial collection
    Sorted = 1,         // Sorted by type
    Processed = 2,      // Processed/cleaned
    Recycled = 3,       // Recycled into material
    Manufactured = 4,   // Manufactured into product
}
```

#### ProcessingRecord Struct
```rust
pub struct ProcessingRecord {
    pub status: ProcessingStatus,   // Status at this point
    pub timestamp: u64,             // When status was set
    pub updated_by: Address,        // Who made the change
}
```

#### Waste Struct Fields
```rust
pub struct Waste {
    // ... existing fields ...
    pub processing_status: ProcessingStatus,        // Current status
    pub processing_history: Vec<ProcessingRecord>,  // Status history
}
```

### Core Functions

#### 1. update_processing_status()
```rust
pub fn update_processing_status(
    env: Env,
    waste_id: u128,
    caller: Address,
    new_status: ProcessingStatus
) -> Waste
```

**Purpose**: Update waste processing status with history tracking

**Parameters**:
- `env`: Soroban environment
- `waste_id`: ID of waste to update
- `caller`: Address making update (must be owner)
- `new_status`: New processing status

**Validation**:
- Caller must be registered participant
- Caller must be waste owner
- New status must be > current status (forward-only)
- Waste must be active

**Side Effects**:
- Updates `processing_status`
- Appends new record to `processing_history`
- Records timestamp and updater address
- Updates recycling stats when reaching Recycled status
- Updates recycling goals progress
- Emits `processing_status_changed` event
- Awards reputation points

**Returns**: Updated Waste struct

**Errors**:
- "Waste not found" - waste_id doesn't exist
- "Only current owner can update processing status" - not owner
- "Status must progress forward" - invalid transition

#### 2. get_wastes_by_status()
```rust
pub fn get_wastes_by_status(
    env: Env,
    status: ProcessingStatus
) -> Vec<u128>
```

**Purpose**: Query all wastes with a specific processing status

**Parameters**:
- `env`: Soroban environment
- `status`: Processing status to filter by

**Returns**: Vector of waste IDs with matching status

**Errors**: None (returns empty vector if no matches)

### Event Emissions

#### processing_status_changed Event
```
Topic: symbol_short!("proc_status")
Data: (waste_id: u128, new_status: u32, updater: Address, timestamp: u64)
Emitted by: update_processing_status()
```

## Usage Examples

### Example 1: Basic Status Progression
```rust
// Waste starts as Collected
let waste_id = client.recycle_waste(
    &WasteType::Plastic,
    &1000,
    &recycler,
    &lat,
    &lon
);
let waste = client.get_waste_v2(&waste_id).unwrap();
assert_eq!(waste.processing_status, ProcessingStatus::Collected);

// Progress through stages
client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Sorted);
client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Processed);
client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Recycled);
client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Manufactured);

let final_waste = client.get_waste_v2(&waste_id).unwrap();
assert_eq!(final_waste.processing_status, ProcessingStatus::Manufactured);
```

### Example 2: History Tracking
```rust
// Submit waste
let waste_id = client.recycle_waste(
    &WasteType::Plastic,
    &1000,
    &recycler,
    &lat,
    &lon
);

// Update status
client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Sorted);

// Check history
let waste = client.get_waste_v2(&waste_id).unwrap();
assert_eq!(waste.processing_history.len(), 2); // Collected + Sorted

// First record is Collected
let first = waste.processing_history.get(0).unwrap();
assert_eq!(first.status, ProcessingStatus::Collected);
assert_eq!(first.updated_by, recycler);

// Second record is Sorted
let second = waste.processing_history.get(1).unwrap();
assert_eq!(second.status, ProcessingStatus::Sorted);
assert_eq!(second.updated_by, recycler);
```

### Example 3: Status-Based Queries
```rust
// Submit multiple wastes
let id1 = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &lat, &lon);
let id2 = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &lat, &lon);

// Advance id2 to Sorted
client.update_processing_status(&id2, &recycler, &ProcessingStatus::Sorted);

// Query by status
let collected = client.get_wastes_by_status(&ProcessingStatus::Collected);
let sorted = client.get_wastes_by_status(&ProcessingStatus::Sorted);

assert!(collected.contains(&id1));
assert!(!collected.contains(&id2));
assert!(sorted.contains(&id2));
assert!(!sorted.contains(&id1));
```

### Example 4: Invalid Transitions
```rust
// Submit waste (starts as Collected)
let waste_id = client.recycle_waste(
    &WasteType::Plastic,
    &1000,
    &recycler,
    &lat,
    &lon
);

// Try to go backwards - FAILS
// This will panic with "Status must progress forward"
client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Collected);

// Try to skip stages - FAILS
client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Manufactured);
```

## Integration Points

### With Confirmation System (#557)
- Confirmation can be tied to specific processing stages
- Confirmed waste has higher processing priority
- Status history includes confirmation events

### With Transfer Approval (#558)
- Transfer moves waste between processing stages
- Status affects transfer eligibility
- Transfer history correlates with status changes

### With Hashing System (#559)
- Hashes updated at different processing stages
- Status history includes hash references
- Final product has manufacturing documentation

### With Reputation System
- Status updates award reputation
- Reaching Recycled status awards bonus reputation
- Processing speed affects reputation

### With Recycling Goals
- Status updates progress toward goals
- Reaching Recycled status counts toward goals
- Goal achievement tracked with status

## Security Considerations

### Access Control
- Only waste owner can update status
- Status updates require authentication
- Prevents unauthorized status changes

### State Integrity
- Forward-only progression enforced
- Cannot skip stages
- Cannot go backwards
- Status changes are immutable

### Audit Trail
- All status changes recorded with timestamp
- Updater address recorded
- Complete history preserved
- Events emitted for all changes

## Testing Strategy

### Unit Tests
1. New waste starts with Collected status
2. Initial history entry creation
3. Owner can advance status
4. History grows with updates
5. Full forward progression
6. Backwards status rejection
7. Same status rejection
8. Non-owner cannot update
9. Non-existent waste handling
10. Status-based queries
11. Empty query results
12. History records correct updater

### Integration Tests
1. Status + confirmation flow
2. Status + transfer flow
3. Status + hashing flow
4. Multiple status updates
5. Status + reputation
6. Status + recycling goals

### Edge Cases
1. Non-existent waste
2. Unregistered updater
3. Deactivated waste
4. Frozen waste (in dispute)
5. Maximum history size

## Performance Characteristics

### Gas Usage
- Update status: ~5,000 gas (storage write + event)
- Query by status: ~50,000 gas (scan all wastes)
- Get history: ~1,000 gas (storage read)

### Storage
- Per status record: ~40 bytes
- History grows with waste lifecycle
- Typical waste: 5-10 records = 200-400 bytes

### Scalability
- Status queries scale with waste count
- Can be optimized with indexing
- History storage is linear with updates

## Status Lifecycle

### Typical Flow
```
1. Collected (0)
   ↓ Waste collected from source
2. Sorted (1)
   ↓ Waste sorted by material type
3. Processed (2)
   ↓ Waste cleaned/prepared
4. Recycled (3)
   ↓ Waste converted to material
5. Manufactured (4)
   ↓ Material made into product
```

### Timing Expectations
- Collected → Sorted: 1-7 days
- Sorted → Processed: 1-14 days
- Processed → Recycled: 1-30 days
- Recycled → Manufactured: 7-60 days

## Future Enhancements

### Potential Improvements
1. **Status Expiry**: Auto-expire wastes at certain status
2. **Status Notifications**: Event-based notifications
3. **Status Conditions**: Conditional status transitions
4. **Status Metadata**: Additional data per status
5. **Status Analytics**: Track processing times
6. **Status Milestones**: Rewards for reaching stages
7. **Status Rollback**: Admin ability to reset status
8. **Batch Status Updates**: Update multiple wastes

## Deployment Checklist

- [x] Functions implemented
- [x] Storage schema defined
- [x] Events defined
- [x] Error handling implemented
- [x] Access control validated
- [x] Unit tests written (12 tests)
- [x] Integration tests written
- [x] Documentation complete
- [x] Security review done
- [x] Performance tested

## References

- Related Issue: #557 (Confirmation)
- Related Issue: #558 (Transfer Approval)
- Related Issue: #559 (Hashing)
- Related Issue: #551 (Reputation System)
- Test File: `tests/waste_processing_status_test.rs`
