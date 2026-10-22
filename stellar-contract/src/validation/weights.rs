use super::amounts::validate_positive_u128;

/// Maximum waste weight per submission in grams (1 000 000 kg).
pub const MAX_WASTE_WEIGHT: u128 = 1_000_000_000;

/// Minimum waste weight per submission in grams (100 g).
pub const MIN_WASTE_WEIGHT: u128 = 100;

/// Validates a waste weight in grams, bounded by `max`.
pub fn validate_weight(weight: u128, max: u128) {
    validate_positive_u128(weight, "Waste weight");
    if weight < MIN_WASTE_WEIGHT {
        panic!("Waste weight must be at least {} grams", MIN_WASTE_WEIGHT);
    }
    if weight > max {
        panic!("Waste weight exceeds maximum allowed; must not exceed {} grams", max);
    }
}

/// Validates the weight and coordinates of a waste submission.
pub fn validate_waste_submission(weight: u128, latitude: i128, longitude: i128) {
    validate_weight(weight, MAX_WASTE_WEIGHT);
    super::paths::validate_coordinates(latitude, longitude);
}
