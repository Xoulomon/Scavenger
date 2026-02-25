# Waste Deactivation Implementation

## Overview
Implemented the waste deactivation feature that allows administrators to deactivate waste records. Once deactivated, waste records cannot be queried and cannot be reactivated, providing a permanent way to remove invalid or problematic waste entries from the active system.

## Implementation Details

### Structural Changes

#### 1. Material Struct Update
Added `is_active` field to the Material struct:

```rust
pub struct Material {
    pub id: u64,
    pub waste_type: WasteType,
    pub weight: u64,
    pub submitter: Address,
    pub current_owner: Address,
    pub submitted_at: u64,
    pub verified: bool,
    pub is_active: bool,  // NEW FIELD
}
```

- New materials are created with `is_active: true` by default
- Field is set to `false` when deactivated by admin

#### 2. New Functions

**get_material (Public Query Function)**
```rust
pub fn get_material(env: &Env, material_id: u64) -> Option<Material>
```
- Returns material only if `is_active` is true
- Returns `None` for deactivated materials
- Provides the query filtering mechanism

**deactivate_waste (Admin Function)**
```rust
pub fn deactivate_waste(env: &Env, admin: Address, waste_id: u64)
```
- Requires admin authentication
- Checks waste exists
- Verifies waste is not already deactivated
- Sets `is_active` to false
- Emits deactivation event

### Core Features

1. **Admin-Only Access**
   - Uses `require_admin` helper function
   - Only the contract admin can deactivate waste
   - Authentication enforced before any operations

2. **Existence Validation**
   - Checks if waste exists before deactivation
   - Clear error message: "Waste not found"

3. **Deactivation Check**
   - Prevents double deactivation
   - Error message: "Waste already deactivated"

4. **Query Filtering**
   - Deactivated waste returns `None` from `get_material`
   - Effectively removes waste from queryable records
   - No way to reactivate once deactivated

5. **Event Emission**
   - Emits `WASTE_DEACTIVATED` event
   - Includes waste_id and admin address
   - Provides audit trail

### Files Modified

1. **contracts/scavenger/src/types.rs**
   - Added `is_active: bool` field to Material struct
   - Updated Material::new() to set `is_active: true`

2. **contracts/scavenger/src/contract.rs**
   - Added `get_material` public function
   - Added `deactivate_waste` function

3. **contracts/scavenger/src/events.rs**
   - Added `WASTE_DEACTIVATED` constant
   - Added `emit_waste_deactivated` function

4. **contracts/scavenger/src/lib.rs**
   - Added `test_deactivate_waste` module

5. **contracts/scavenger/src/test_deactivate_waste.rs** (New File)
   - Comprehensive test suite with 9 test cases

## Test Coverage

### Test Cases Implemented

1. **test_deactivate_waste_success**
   - Verifies successful deactivation by admin
   - Confirms waste becomes non-queryable after deactivation

2. **test_deactivate_waste_non_admin**
   - Ensures only admin can deactivate
   - Validates authentication enforcement

3. **test_deactivate_waste_not_found**
   - Tests error handling for non-existent waste

4. **test_deactivate_waste_already_deactivated**
   - Prevents double deactivation
   - Validates state checking

5. **test_deactivated_waste_not_queryable**
   - Confirms deactivated waste returns None
   - Tests selective deactivation (some active, some not)

6. **test_deactivate_waste_multiple**
   - Tests batch deactivation
   - Verifies all deactivated wastes are non-queryable

7. **test_new_material_is_active_by_default**
   - Confirms new materials start as active
   - Validates default behavior

8. **test_deactivate_waste_different_waste_types**
   - Tests deactivation across all waste types
   - Ensures type-agnostic functionality

## Acceptance Criteria Status

✅ **Only admin can deactivate**
- Implemented via `Self::require_admin(env, &admin)`
- Authentication enforced before any operations
- Non-admin attempts result in error

✅ **Deactivated waste not queryable**
- `get_material` returns `None` for deactivated waste
- Effectively removes waste from active records
- Test coverage confirms behavior

✅ **Cannot be reactivated**
- No reactivation function provided
- `is_active` can only transition from true to false
- Once deactivated, permanently removed from queries

## Event Tracking

New event type for monitoring waste deactivation:
```rust
const WASTE_DEACTIVATED: Symbol = symbol_short!("wst_deact");
```

Event payload includes:
- `waste_id`: ID of the deactivated waste
- `admin`: Address of the admin who performed deactivation

## Usage Example

```rust
// Submit a waste material
let material = client.submit_material(
    &submitter,
    &WasteType::Paper,
    &5000,
);

// Material is active and queryable
let retrieved = client.get_material(&material.id);
assert!(retrieved.is_some());

// Admin deactivates the waste
client.deactivate_waste(&admin, &material.id);

// Material is no longer queryable
let retrieved_after = client.get_material(&material.id);
assert!(retrieved_after.is_none());
```

## Security Considerations

1. **Authorization**: Only admin can deactivate waste
2. **Immutability**: Deactivation is permanent (no reactivation)
3. **Validation**: Checks for existence and current state
4. **Audit Trail**: Events provide complete deactivation history
5. **Data Integrity**: Original data preserved, only query visibility changed

## Use Cases

### Valid Reasons for Deactivation

1. **Fraudulent Submissions**
   - Remove fake or fraudulent waste entries
   - Prevent reward exploitation

2. **Data Entry Errors**
   - Correct mistakes in waste submissions
   - Remove duplicate entries

3. **Policy Violations**
   - Remove waste that violates system policies
   - Handle non-compliant submissions

4. **System Cleanup**
   - Archive old or irrelevant waste records
   - Maintain data quality

## Integration Notes

### Breaking Changes
⚠️ **Material struct has changed** - Added `is_active` field
- Existing contracts need to be redeployed
- Existing data may need migration
- All Material instances now include `is_active` field

### Backward Compatibility
- New `get_material` function provides filtered access
- Existing code using Storage::get_material directly will see all materials
- Recommended to use public `get_material` function for proper filtering

### Migration Strategy
For existing deployments:
1. Deploy updated contract
2. All existing materials will need `is_active` field set
3. Consider migration script to set `is_active: true` for all existing materials
4. Update client code to use new Material structure

## API Reference

### deactivate_waste
```rust
pub fn deactivate_waste(env: &Env, admin: Address, waste_id: u64)
```

**Parameters:**
- `admin`: Address of the admin (must be contract admin)
- `waste_id`: ID of the waste to deactivate

**Errors:**
- "Only admin can perform this action" - Caller is not admin
- "Waste not found" - Invalid waste ID
- "Waste already deactivated" - Waste is already inactive

**Events:**
- Emits `WASTE_DEACTIVATED` with waste_id and admin address

### get_material
```rust
pub fn get_material(env: &Env, material_id: u64) -> Option<Material>
```

**Parameters:**
- `material_id`: ID of the material to retrieve

**Returns:**
- `Some(Material)` if material exists and is active
- `None` if material doesn't exist or is deactivated

## Next Steps

To use this feature:
1. Build the contract with updated Material struct
2. Deploy the updated contract (note: breaking change)
3. Migrate existing data if necessary
4. Admin can call `deactivate_waste` with waste IDs
5. Monitor `WASTE_DEACTIVATED` events for tracking
6. Use `get_material` for filtered queries

## Performance Considerations

- Deactivation is O(1) operation
- Query filtering adds minimal overhead
- No impact on other contract operations
- Event emission is lightweight

## Future Enhancements

Potential improvements:
1. Batch deactivation function
2. Deactivation reason field
3. Admin notes/comments
4. Deactivation history tracking
5. Soft delete with archive functionality
