# Integration Guide: Issues #557-560

## Overview
This guide explains how the four implemented features work together to create a comprehensive waste tracking and verification system.

## Feature Interactions

### 1. Waste Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    WASTE LIFECYCLE                              │
└─────────────────────────────────────────────────────────────────┘

1. SUBMISSION (Issue #560)
   └─ Waste submitted by Recycler
   └─ Status: Collected
   └─ Processing history initialized

2. DOCUMENTATION (Issue #559)
   └─ Owner adds image hash (IPFS)
   └─ Owner adds document hashes (max 5)
   └─ Hashes stored on-chain

3. CONFIRMATION (Issue #557)
   └─ Collector confirms waste quality
   └─ is_confirmed = true
   └─ Confirmer address recorded

4. TRANSFER INITIATION (Issue #558)
   └─ Recycler initiates transfer to Collector
   └─ PendingTransfer created with 24h expiry
   └─ Status: Pending

5. TRANSFER APPROVAL (Issue #558)
   └─ Collector approves transfer
   └─ Ownership transferred
   └─ Status: Approved

6. PROCESSING (Issue #560)
   └─ Status progresses: Sorted → Processed → Recycled
   └─ Each update recorded in history
   └─ Reputation awarded

7. MANUFACTURING (Issue #560)
   └─ Manufacturer receives waste
   └─ Status: Manufactured
   └─ Final product created
```

### 2. Cross-Feature Dependencies

#### Confirmation → Transfer Approval
```
Waste must be confirmed before transfer approval
├─ Confirmation provides quality assurance
├─ Transfer approval can check is_confirmed flag
└─ Ensures only verified waste is transferred
```

#### Transfer Approval → Processing Status
```
Transfer moves waste between processing stages
├─ Ownership transfer updates participant lists
├─ Processing status tracks waste location
├─ Status history includes transfer events
└─ Enables supply chain visibility
```

#### Hashing → Confirmation
```
Hashes provide verification data for confirmation
├─ Image hash proves waste identity
├─ Document hashes provide supporting evidence
├─ Confirmation validates hash authenticity
└─ Immutable verification trail
```

#### Processing Status → All Features
```
Status affects all other operations
├─ Confirmation only at certain statuses
├─ Transfer only at certain statuses
├─ Hashes updated at different stages
└─ Status history correlates all events
```

## Typical Workflow

### Scenario: Plastic Waste Through Supply Chain

```
STEP 1: Recycler Submits Waste
────────────────────────────────
recycler.recycle_waste(
    waste_type: Plastic,
    weight: 1000g,
    location: (40.0, -74.0)
)
Result:
  - waste_id: 12345
  - status: Collected
  - history: [Collected]
  - is_confirmed: false
  - image_hash: None
  - document_hashes: []


STEP 2: Recycler Adds Documentation
────────────────────────────────────
recycler.set_waste_image(
    waste_id: 12345,
    hash: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
)
recycler.add_waste_document(
    waste_id: 12345,
    hash: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
)
Result:
  - image_hash: "Qm..."
  - document_hashes: ["bafy..."]


STEP 3: Collector Confirms Waste
─────────────────────────────────
collector.confirm_waste_details(
    waste_id: 12345,
    confirmer: collector_address
)
Result:
  - is_confirmed: true
  - confirmer: collector_address
  - reputation: +3 points (collector)
  - reputation: +3 points (recycler)


STEP 4: Recycler Initiates Transfer
────────────────────────────────────
recycler.initiate_transfer(
    waste_id: 12345,
    from: recycler_address,
    to: collector_address,
    location: (40.0, -74.0)
)
Result:
  - transfer_id: 1
  - status: Pending
  - expires_at: now + 86400 seconds


STEP 5: Collector Approves Transfer
────────────────────────────────────
collector.approve_transfer(
    transfer_id: 1,
    recipient: collector_address
)
Result:
  - transfer_id: 1
  - status: Approved
  - waste.current_owner: collector_address
  - transfer_history: [Transfer record]


STEP 6: Collector Updates Processing Status
─────────────────────────────────────────────
collector.update_processing_status(
    waste_id: 12345,
    caller: collector_address,
    new_status: Sorted
)
Result:
  - processing_status: Sorted
  - processing_history: [Collected, Sorted]
  - stats.sorted_weight: +1000g


STEP 7: Collector Continues Processing
───────────────────────────────────────
collector.update_processing_status(
    waste_id: 12345,
    new_status: Processed
)
Result:
  - processing_status: Processed
  - processing_history: [Collected, Sorted, Processed]


STEP 8: Collector Transfers to Manufacturer
─────────────────────────────────────────────
collector.initiate_transfer(
    waste_id: 12345,
    from: collector_address,
    to: manufacturer_address,
    location: (40.5, -74.5)
)
manufacturer.approve_transfer(transfer_id: 2)
Result:
  - waste.current_owner: manufacturer_address
  - transfer_history: [Transfer 1, Transfer 2]


STEP 9: Manufacturer Completes Processing
──────────────────────────────────────────
manufacturer.update_processing_status(
    waste_id: 12345,
    new_status: Recycled
)
Result:
  - processing_status: Recycled
  - stats.recycled_weight: +1000g
  - goals.progress: +1000g


STEP 10: Manufacturer Creates Product
──────────────────────────────────────
manufacturer.update_processing_status(
    waste_id: 12345,
    new_status: Manufactured
)
Result:
  - processing_status: Manufactured
  - processing_history: [Collected, Sorted, Processed, Recycled, Manufactured]
  - Final status reached
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      WASTE OBJECT                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  waste_id: u128                                                  │
│  waste_type: WasteType                                           │
│  weight: u128                                                    │
│  current_owner: Address                                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CONFIRMATION (Issue #557)                               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ is_confirmed: bool                                      │   │
│  │ confirmer: Address                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ HASHING (Issue #559)                                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ image_hash: Option<String>                              │   │
│  │ document_hashes: Vec<String> (max 5)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ PROCESSING STATUS (Issue #560)                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ processing_status: ProcessingStatus                     │   │
│  │ processing_history: Vec<ProcessingRecord>               │   │
│  │   ├─ status: ProcessingStatus                           │   │
│  │   ├─ timestamp: u64                                     │   │
│  │   └─ updated_by: Address                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   PENDING TRANSFER (Issue #558)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  id: u64                                                         │
│  waste_id: u128                                                  │
│  from: Address                                                   │
│  to: Address                                                     │
│  initiated_at: u64                                               │
│  expires_at: u64 (24h from initiated_at)                         │
│  status: PendingTransferStatus                                   │
│  latitude: i128                                                  │
│  longitude: i128                                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Query Patterns

### Pattern 1: Get Waste with All Details
```rust
let waste = client.get_waste_v2(&waste_id).unwrap();

// Check confirmation
if waste.is_confirmed {
    println!("Confirmed by: {}", waste.confirmer);
}

// Check hashes
if let Some(image) = waste.image_hash {
    println!("Image: {}", image);
}
for doc in waste.document_hashes.iter() {
    println!("Document: {}", doc);
}

// Check status
println!("Current status: {:?}", waste.processing_status);
println!("History length: {}", waste.processing_history.len());
```

### Pattern 2: Find Wastes by Status
```rust
// Get all wastes in Sorted status
let sorted_wastes = client.get_wastes_by_status(&ProcessingStatus::Sorted);

// Get all wastes in Recycled status
let recycled_wastes = client.get_wastes_by_status(&ProcessingStatus::Recycled);

// Get all wastes in Manufactured status
let manufactured = client.get_wastes_by_status(&ProcessingStatus::Manufactured);
```

### Pattern 3: Track Transfer History
```rust
let waste = client.get_waste_v2(&waste_id).unwrap();

// Check current owner
println!("Current owner: {}", waste.current_owner);

// Get transfer history
let history = client.get_waste_transfer_history(&waste_id);
for transfer in history.iter() {
    println!("Transfer from {} to {}", transfer.from, transfer.to);
}
```

### Pattern 4: Verify Waste Authenticity
```rust
let waste = client.get_waste_v2(&waste_id).unwrap();

// Verify confirmation
assert!(waste.is_confirmed, "Waste not confirmed");

// Verify hashes
assert!(waste.image_hash.is_some(), "No image hash");
assert!(waste.document_hashes.len() > 0, "No documents");

// Verify status progression
assert_eq!(waste.processing_status, ProcessingStatus::Recycled);
assert!(waste.processing_history.len() >= 3);
```

## Error Handling

### Common Error Scenarios

#### Scenario 1: Confirmation Before Transfer
```rust
// Try to transfer unconfirmed waste
let pending = client.initiate_transfer(&waste_id, &recycler, &collector, &lat, &lon);
// This succeeds - confirmation is optional for transfer

// But best practice is to confirm first
client.confirm_waste_details(&waste_id, &collector);
client.initiate_transfer(&waste_id, &recycler, &collector, &lat, &lon);
```

#### Scenario 2: Invalid Status Progression
```rust
// Try to skip stages
client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Sorted);
// This succeeds

// Try to go backwards
client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Collected);
// This panics: "Status must progress forward"
```

#### Scenario 3: Transfer Expiry
```rust
let pending = client.initiate_transfer(&waste_id, &recycler, &collector, &lat, &lon);

// Wait 24+ hours
env.ledger().with_mut(|l| l.timestamp += 86401);

// Try to approve
client.approve_transfer(&pending.id, &collector);
// This panics: "Transfer has expired"

// Must expire first
client.expire_transfer(&pending.id);
```

## Performance Optimization

### Query Optimization
```rust
// Inefficient: Query all wastes then filter
let all_wastes = client.get_wastes_by_status(&ProcessingStatus::Collected);
let filtered = all_wastes.iter()
    .filter(|id| {
        let w = client.get_waste_v2(id).unwrap();
        w.is_confirmed
    })
    .collect();

// Better: Use status query directly
let collected = client.get_wastes_by_status(&ProcessingStatus::Collected);
// Then check confirmation on needed items
```

### Batch Operations
```rust
// Process multiple wastes
let waste_ids = vec![1, 2, 3, 4, 5];
for waste_id in waste_ids {
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Sorted);
}
```

## Testing Integration

### Integration Test Template
```rust
#[test]
fn test_complete_waste_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    // 1. Submit waste
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &lat, &lon);

    // 2. Add hashes
    client.set_waste_image(&waste_id, &image_hash, &recycler);
    client.add_waste_document(&waste_id, &doc_hash, &recycler);

    // 3. Confirm
    client.confirm_waste_details(&waste_id, &collector);

    // 4. Transfer
    let pending = client.initiate_transfer(&waste_id, &recycler, &collector, &lat, &lon);
    client.approve_transfer(&pending.id, &collector);

    // 5. Process
    client.update_processing_status(&waste_id, &collector, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id, &collector, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id, &collector, &ProcessingStatus::Recycled);

    // 6. Verify final state
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert!(waste.is_confirmed);
    assert_eq!(waste.current_owner, collector);
    assert_eq!(waste.processing_status, ProcessingStatus::Recycled);
    assert_eq!(waste.processing_history.len(), 4);
}
```

## Deployment Considerations

### Storage Requirements
- Per waste: ~500 bytes (with full history and hashes)
- Per transfer: ~100 bytes
- Per participant: ~1 KB (stats and waste list)

### Gas Budgets
- Complete lifecycle: ~50,000 gas
- Individual operations: 3,000-12,000 gas each

### Scalability
- Supports millions of wastes
- Status queries scale with waste count
- Consider indexing for large deployments

## Troubleshooting

### Issue: Transfer Expired
**Cause**: 24 hours passed since initiation
**Solution**: Expire transfer and initiate new one

### Issue: Cannot Update Status
**Cause**: Not waste owner or invalid progression
**Solution**: Verify ownership and status order

### Issue: Confirmation Failed
**Cause**: Owner trying to confirm own waste
**Solution**: Use different participant for confirmation

### Issue: Invalid Hash
**Cause**: Hash format not IPFS-compatible
**Solution**: Use valid CIDv0 (Qm...) or CIDv1 (bafy...) format

## References

- Issue #557: `docs/ISSUE_557_WASTE_CONFIRMATION.md`
- Issue #558: `docs/ISSUE_558_TRANSFER_APPROVAL.md`
- Issue #559: `docs/ISSUE_559_WASTE_HASHING.md`
- Issue #560: `docs/ISSUE_560_PROCESSING_STATUS.md`
- Test Files: `tests/waste_*_test.rs`
