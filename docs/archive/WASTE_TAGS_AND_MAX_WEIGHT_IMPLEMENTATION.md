# Waste Tags System and Max Weight Validation Implementation

## Overview

This document describes the implementation of two key features for the Scavenger recycling platform:
1. **Waste Tags System** (Issue #561) - Allow tagging waste with custom metadata
2. **Max Weight Validation** (Issue #562) - Implement maximum weight limits for waste items

## Issue #561: Waste Tags System

### Description
The waste tags system allows participants to tag waste items with custom metadata for better organization and filtering. Tags are case-insensitive, have length limits, and support filtering operations.

### Implementation Details

#### Data Structure
Tags are stored as a vector of strings in the `Waste` struct:
```rust
pub struct Waste {
    // ... other fields ...
    /// Category tags for filtering (max 10, each max 20 chars, lowercase)
    pub tags: soroban_sdk::Vec<soroban_sdk::String>,
    // ... other fields ...
}
```

#### Constants
- `MAX_TAGS: u32 = 10` - Maximum number of tags per waste item
- `MAX_TAG_LEN: u32 = 20` - Maximum length of each tag in characters

#### Core Functions

##### 1. `add_waste_tag(env, waste_id, tag, caller) -> Waste`
Adds a tag to a waste item with the following behavior:
- **Normalization**: Tags are converted to lowercase for case-insensitive comparison
- **Validation**: 
  - Tag cannot be empty
  - Tag length must not exceed 20 characters
  - Maximum 10 tags per waste item
- **Deduplication**: Duplicate tags (after normalization) are silently ignored
- **Authorization**: Only the current waste owner can add tags
- **State Check**: Cannot add tags to deactivated waste items

**Parameters:**
- `waste_id: u128` - The ID of the waste item
- `tag: String` - The tag to add (will be normalized to lowercase)
- `caller: Address` - The address attempting to add the tag (must be waste owner)

**Returns:** Updated `Waste` struct

**Errors:**
- "Tag cannot be empty" - If tag is empty string
- "Tag exceeds maximum length of 20 characters" - If tag length > 20
- "Tag limit reached" - If waste already has 10 tags
- "Waste not found" - If waste_id doesn't exist
- "Waste is deactivated" - If waste is no longer active
- "Only the waste owner can add tags" - If caller is not the waste owner

##### 2. `remove_waste_tag(env, waste_id, tag, caller) -> Waste`
Removes a tag from a waste item with the following behavior:
- **Case-Insensitive**: Tag matching is case-insensitive (normalized to lowercase)
- **No-op**: Removing a non-existent tag is a no-op (no error)
- **Authorization**: Only the current waste owner can remove tags

**Parameters:**
- `waste_id: u128` - The ID of the waste item
- `tag: String` - The tag to remove (will be normalized to lowercase)
- `caller: Address` - The address attempting to remove the tag (must be waste owner)

**Returns:** Updated `Waste` struct

**Errors:**
- "Waste not found" - If waste_id doesn't exist
- "Only the waste owner can remove tags" - If caller is not the waste owner

##### 3. `get_wastes_by_tag(env, tag) -> Vec<u128>`
Retrieves all active waste items with a specific tag.
- **Case-Insensitive**: Tag matching is case-insensitive (normalized to lowercase)
- **Active Only**: Only returns active (non-deactivated) waste items
- **Efficient**: Iterates through all waste items to find matches

**Parameters:**
- `tag: String` - The tag to search for (will be normalized to lowercase)

**Returns:** Vector of waste IDs that have the specified tag

**Example Usage:**
```rust
// Add tags to waste items
let waste1 = client.add_waste_tag(&waste_id_1, &String::from_str(&env, "recyclable"), &owner);
let waste2 = client.add_waste_tag(&waste_id_2, &String::from_str(&env, "RECYCLABLE"), &owner);

// Search for wastes by tag (case-insensitive)
let results = client.get_wastes_by_tag(&String::from_str(&env, "recyclable"));
// results contains both waste_id_1 and waste_id_2
```

#### Tag Normalization
The `normalise_tag()` function:
1. Validates tag is not empty
2. Validates tag length ≤ 20 characters
3. Converts all uppercase ASCII letters (A-Z) to lowercase (a-z)
4. Returns the normalized string

#### Storage
Tags are stored as part of the waste record in Soroban instance storage:
- Key: `("waste_v2", waste_id)`
- Value: Complete `Waste` struct including tags vector

### Testing
Comprehensive tests are provided in `stellar-contract/tests/waste_tags_test.rs`:
- Basic tag addition and retrieval
- Tag normalization to lowercase
- Duplicate tag handling
- Tag limit enforcement (max 10)
- Tag length validation (max 20 chars)
- Empty tag rejection
- Tag removal
- Non-existent tag removal (no-op)
- Tag-based filtering
- Authorization checks
- Deactivated waste protection
- Boundary conditions (exactly 20 chars)

### Use Cases
1. **Categorization**: Tag waste as "recyclable", "hazardous", "organic", etc.
2. **Quality Marking**: Tag waste with quality indicators like "premium", "standard"
3. **Processing Status**: Tag waste with processing status like "pending", "verified"
4. **Custom Metadata**: Allow participants to add custom tags for their workflows

---

## Issue #562: Max Weight Validation

### Description
Implement maximum weight limits for waste items to prevent system abuse and ensure data integrity. The system enforces a configurable maximum weight limit on all waste submissions.

### Implementation Details

#### Configuration
- `MAX_WASTE_WEIGHT: u128 = 1_000_000_000` (1 billion grams = 1,000 metric tons)

This limit is:
- Configurable via contract constants
- Applied to all waste submission methods
- Enforced at the contract level

#### Validation Points

##### 1. `recycle_waste()` Function
Validates weight during waste recycling:
```rust
if weight > MAX_WASTE_WEIGHT {
    panic!("Waste weight exceeds maximum allowed");
}
```

**Parameters:**
- `weight: u128` - Weight in grams

**Validation:**
- Weight must be ≥ minimum weight (configurable)
- Weight must be ≤ maximum weight (1,000,000,000 grams)

##### 2. `submit_material()` Function
Validates weight during material submission:
```rust
if weight as u128 > MAX_WASTE_WEIGHT {
    panic!("Waste weight exceeds maximum allowed");
}
```

**Parameters:**
- `weight: u64` - Weight in grams (converted to u128 for comparison)

**Validation:**
- Weight must be ≥ minimum weight (configurable)
- Weight must be ≤ maximum weight (1,000,000,000 grams)

##### 3. `submit_materials_batch()` Function
Batch submission also validates each item's weight:
- Each material in the batch is validated individually
- Batch submission fails if any item exceeds max weight

#### Weight Limits
- **Minimum Weight**: Configurable via `set_min_weight()` (default: 1 gram)
- **Maximum Weight**: 1,000,000,000 grams (1,000 metric tons)
- **Unit**: All weights are in grams for precision

#### Error Handling
When weight validation fails:
- Error message: "Waste weight exceeds maximum allowed"
- Transaction is rejected
- No state changes occur

### Testing
Comprehensive tests are provided in `stellar-contract/tests/max_weight_validation_test.rs`:
- Weight at maximum limit (succeeds)
- Weight above maximum limit (fails)
- Weight below maximum limit (succeeds)
- Batch submission with max weight items
- Batch submission with over-limit items (fails)

### Use Cases
1. **System Protection**: Prevent unrealistic waste submissions
2. **Data Integrity**: Ensure weight values are within reasonable bounds
3. **Resource Management**: Prevent storage bloat from extremely large values
4. **Compliance**: Enforce business rules on waste quantities

### Configuration
To modify the maximum weight limit, update the constant in `stellar-contract/src/lib.rs`:
```rust
const MAX_WASTE_WEIGHT: u128 = 1_000_000_000; // 1 billion grams
```

Then rebuild the contract:
```bash
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm
```

---

## Integration

### Combined Usage Example
```rust
// Register a recycler
let recycler = Address::generate(&env);
client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &lat, &lon);

// Submit waste within weight limits
let waste_id = client.recycle_waste(
    &WasteType::Plastic,
    &500_000_000u128,  // 500 million grams (within limit)
    &recycler,
    &0i128,
    &0i128
);

// Add tags for categorization
client.add_waste_tag(&waste_id, &String::from_str(&env, "recyclable"), &recycler);
client.add_waste_tag(&waste_id, &String::from_str(&env, "premium"), &recycler);

// Query wastes by tag
let recyclable_wastes = client.get_wastes_by_tag(&String::from_str(&env, "recyclable"));
```

---

## Performance Considerations

### Tags System
- **Storage**: O(1) per tag (stored in waste record)
- **Lookup**: O(n) where n = number of waste items (full scan for tag-based queries)
- **Memory**: Minimal overhead (10 strings × 20 chars max = 200 bytes per waste)

### Weight Validation
- **Validation**: O(1) - Simple numeric comparison
- **Storage**: No additional storage overhead
- **Performance**: Negligible impact on transaction cost

### Optimization Recommendations
1. For large-scale tag queries, consider implementing an index
2. Cache frequently searched tags
3. Batch tag operations when possible

---

## Security Considerations

### Tags System
- **Authorization**: Only waste owner can add/remove tags
- **Immutability**: Tags cannot be modified, only added/removed
- **Deactivation Protection**: Cannot tag deactivated waste
- **Input Validation**: All tag inputs are validated for length and content

### Weight Validation
- **Overflow Protection**: Uses u128 to prevent overflow
- **Boundary Checking**: Validates both min and max limits
- **Atomic Operations**: Weight validation is part of atomic waste creation

---

## Future Enhancements

### Tags System
1. **Tag Indexing**: Create reverse index for faster tag-based queries
2. **Tag Suggestions**: Provide common tag suggestions based on waste type
3. **Tag Hierarchy**: Support tag categories and subcategories
4. **Tag Permissions**: Allow different roles to manage different tags
5. **Tag Analytics**: Track tag usage statistics

### Weight Validation
1. **Dynamic Limits**: Allow different limits per waste type
2. **Role-Based Limits**: Different limits for different participant roles
3. **Time-Based Limits**: Adjust limits based on time periods
4. **Adaptive Limits**: Adjust limits based on system load

---

## References

- **Issue #561**: [Backend] Implement waste tags system
- **Issue #562**: [Backend] Add waste maximum weight validation
- **Test Files**:
  - `stellar-contract/tests/waste_tags_test.rs`
  - `stellar-contract/tests/max_weight_validation_test.rs`
- **Implementation Files**:
  - `stellar-contract/src/lib.rs` (main contract)
  - `stellar-contract/src/types.rs` (Waste struct)
