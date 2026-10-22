# Recycling Statistics System

The `RecyclingStats` struct provides comprehensive tracking of participant recycling activity.

## RecyclingStats Struct

| Field | Type | Description |
|-------|------|-------------|
| `participant` | `Address` | Participant's address |
| `total_submissions` | `u64` | Total materials submitted |
| `verified_submissions` | `u64` | Number of verified materials |
| `total_weight` | `u64` | Total weight in grams |
| `total_points` | `u64` | Total reward points earned |
| `paper_count` | `u64` | Number of paper submissions |
| `pet_plastic_count` | `u64` | Number of PET plastic submissions |
| `plastic_count` | `u64` | Number of plastic submissions |
| `metal_count` | `u64` | Number of metal submissions |
| `glass_count` | `u64` | Number of glass submissions |

## Key Features

### 1. Automatic Tracking

- Stats automatically updated on material submission
- Points calculated on verification
- Waste type counts maintained

### 2. Performance Metrics

- Verification rate (percentage of verified materials)
- Average weight per submission
- Most submitted waste type
- Total points earned

### 3. Achievement Badges

- **Active Recycler** — 10+ submissions
- **Verified Contributor** — 80%+ verification rate

## Methods

### `record_submission(material)`

- Increments submission count
- Adds to total weight
- Updates waste type counter

### `record_verification(material)`

- Increments verified count
- Adds reward points
- Only counts verified materials

### `verification_rate() -> u64`

Returns percentage (0–100). Formula: `(verified / total) * 100`

### `most_submitted_type() -> Option<WasteType>`

Returns the most frequently submitted waste type, or `None` if no submissions.

### `average_weight() -> u64`

Returns average weight per submission in grams, or `0` if no submissions.

### `is_active_recycler() -> bool`

Returns `true` if the participant has 10+ submissions (badge qualification).

### `is_verified_contributor() -> bool`

Returns `true` if the participant has an 80%+ verification rate (badge qualification).

## Contract Functions

### `get_stats(participant: Address) -> Option<RecyclingStats>`

Retrieves statistics for a participant. Returns `None` if no submissions yet.

## Automatic Updates

Stats are automatically updated when:

**1. Material Submission**

```
submit_material() calls stats.record_submission()
  - Increments total_submissions
  - Adds to total_weight
  - Updates waste type count
```

**2. Material Verification**

```
verify_material() calls stats.record_verification()
  - Increments verified_submissions
  - Adds reward points
```

## Usage Examples

### Check Participant Performance

```rust
let stats = contract.get_stats(participant_address)?;
let rate = stats.verification_rate();
if rate >= 80 {
    // Award "Verified Contributor" badge
}
```

### Identify Top Recyclers

```rust
let stats = contract.get_stats(participant_address)?;
if stats.is_active_recycler() {
    // Participant has 10+ submissions
}
```

### Analyze Recycling Patterns

```rust
let stats = contract.get_stats(participant_address)?;
let most_common = stats.most_submitted_type();
// Suggest focusing on other waste types
```

## Storage

Stats are stored in Soroban instance storage:

| Key | Value |
|-----|-------|
| `("stats", participant_address)` | `RecyclingStats` struct |

## Integration

`RecyclingStats` integrates with:

- **Material** — tracks material submissions
- **WasteType** — counts by waste type
- **ParticipantRole** — can be used for role-based rewards

## Future Enhancements

- Leaderboards (top recyclers by points)
- Time-based statistics (monthly, yearly)
- Environmental impact calculations (CO2 saved)
- Streak tracking (consecutive days)
- Team/organization statistics
- Reward tier system based on points
- Historical data and trends
- Export statistics for reporting
