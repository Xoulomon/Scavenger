# Material Tracking System

The `Material` struct provides a comprehensive system for tracking recyclable materials
in the Scavngr ecosystem.

## Material Struct

| Field | Type | Description |
|-------|------|-------------|
| `id` | `u64` | Unique identifier |
| `waste_type` | `WasteType` | Type of waste (Paper, PetPlastic, Plastic, Metal, Glass) |
| `weight` | `u64` | Weight in grams |
| `submitter` | `Address` | Participant who submitted the material |
| `submitted_at` | `u64` | Timestamp of submission |
| `verified` | `bool` | Verification status |
| `description` | `String` | Optional description |

## Reward Point System

Materials earn reward points based on type and weight.

### Multipliers

| Waste Type | Multiplier | Notes |
|------------|-----------|-------|
| Paper | 1× | Base rate |
| PetPlastic | 3× | High value recyclable |
| Plastic | 2× | Medium value |
| Metal | 5× | Highest value — infinitely recyclable |
| Glass | 2× | Medium value — infinitely recyclable |

**Formula:** `Points = (weight in kg) × multiplier × 10`

**Examples:**

- 5 kg Paper: 5 × 1 × 10 = **50 points**
- 5 kg PetPlastic: 5 × 3 × 10 = **150 points**
- 5 kg Metal: 5 × 5 × 10 = **250 points**

## Minimum Weight Requirement

Materials must weigh at least **100 grams** to be accepted.

## Contract Functions

### `submit_material(waste_type, weight, submitter, description)`

Submits a new material for recycling.

- Requires submitter authorization
- Auto-generates a unique material ID
- Returns: `Material` struct

### `get_material(material_id)`

Retrieves a material by ID.

- Returns: `Option<Material>`

### `verify_material(material_id, verifier)`

Verifies a material submission.

- Only recyclers can verify
- Requires verifier authorization
- Returns: Updated `Material` struct

## Workflow

```
1. Participant submits material
   └─> submit_material() creates Material with verified=false

2. Recycler verifies material
   └─> verify_material() sets verified=true

3. System calculates rewards
   └─> calculate_reward_points() determines points earned
```

## Storage

Materials are stored in Soroban instance storage:

| Key | Value |
|-----|-------|
| `("material", material_id)` | `Material` struct |
| `("material_count",)` | `u64` (last material ID) |

## Integration with WasteType

The `Material` struct uses the `WasteType` enum to:

- Categorize materials
- Calculate appropriate rewards
- Enable filtering by waste type
- Track recycling statistics

## Future Enhancements

- Batch material submissions
- Material status tracking (submitted, verified, processed, recycled)
- Location tracking
- Photo/image attachments
- Quality ratings
- Reward token distribution
- Material history and audit trail
