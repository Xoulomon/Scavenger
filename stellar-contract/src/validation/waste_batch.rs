//! Waste-batch-specific validation rules.
//!
//! Split out of the monolithic `validation.rs` so waste submission rules can
//! be located and unit tested independently of participant/transfer rules.

use super::{MAX_LAT, MAX_LON, MAX_TAGS, MAX_TAG_LEN, MAX_WASTE_WEIGHT, MIN_WASTE_WEIGHT, ValidationError};

/// Validates a waste submission: weight range and coordinates.
pub fn validate_submission(weight: u128, latitude: i128, longitude: i128) -> Result<(), ValidationError> {
    validate_weight(weight)?;
    validate_coordinates(latitude, longitude)
}

/// Validates a waste weight in grams against the global min/max bounds.
pub fn validate_weight(weight: u128) -> Result<(), ValidationError> {
    if weight < MIN_WASTE_WEIGHT {
        return Err(ValidationError::OutOfRange {
            field: "waste weight",
            min: MIN_WASTE_WEIGHT as i128,
            max: MAX_WASTE_WEIGHT as i128,
        });
    }
    if weight > MAX_WASTE_WEIGHT {
        return Err(ValidationError::OutOfRange {
            field: "waste weight",
            min: MIN_WASTE_WEIGHT as i128,
            max: MAX_WASTE_WEIGHT as i128,
        });
    }
    Ok(())
}

/// Validates the number of tags attached to a waste batch.
pub fn validate_tag_count(count: u32) -> Result<(), ValidationError> {
    if count > MAX_TAGS {
        return Err(ValidationError::CollectionTooLarge {
            field: "waste tags",
            max: MAX_TAGS,
        });
    }
    Ok(())
}

/// Validates a single tag's length.
pub fn validate_tag_len(tag: &soroban_sdk::String) -> Result<(), ValidationError> {
    if tag.len() > MAX_TAG_LEN {
        return Err(ValidationError::StringTooLong {
            field: "waste tag",
            max_len: MAX_TAG_LEN,
        });
    }
    Ok(())
}

fn validate_coordinates(latitude: i128, longitude: i128) -> Result<(), ValidationError> {
    if !(-MAX_LAT..=MAX_LAT).contains(&latitude) {
        return Err(ValidationError::OutOfRange {
            field: "latitude",
            min: -MAX_LAT,
            max: MAX_LAT,
        });
    }
    if !(-MAX_LON..=MAX_LON).contains(&longitude) {
        return Err(ValidationError::OutOfRange {
            field: "longitude",
            min: -MAX_LON,
            max: MAX_LON,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn submission_accepts_valid_weight_and_coordinates() {
        assert!(validate_submission(1_000, 0, 0).is_ok());
    }

    #[test]
    fn submission_rejects_weight_below_minimum() {
        assert!(matches!(
            validate_submission(1, 0, 0),
            Err(ValidationError::OutOfRange { field: "waste weight", .. })
        ));
    }

    #[test]
    fn submission_rejects_weight_above_maximum() {
        assert!(matches!(
            validate_submission(MAX_WASTE_WEIGHT + 1, 0, 0),
            Err(ValidationError::OutOfRange { field: "waste weight", .. })
        ));
    }

    #[test]
    fn submission_rejects_bad_coordinates_even_with_valid_weight() {
        assert!(matches!(
            validate_submission(1_000, 999_000_000, 0),
            Err(ValidationError::OutOfRange { field: "latitude", .. })
        ));
    }

    #[test]
    fn weight_accepts_boundary_values() {
        assert!(validate_weight(MIN_WASTE_WEIGHT).is_ok());
        assert!(validate_weight(MAX_WASTE_WEIGHT).is_ok());
    }

    #[test]
    fn weight_rejects_zero() {
        assert!(validate_weight(0).is_err());
    }

    #[test]
    fn tag_count_accepts_within_limit() {
        assert!(validate_tag_count(MAX_TAGS).is_ok());
    }

    #[test]
    fn tag_count_rejects_over_limit() {
        assert_eq!(
            validate_tag_count(MAX_TAGS + 1),
            Err(ValidationError::CollectionTooLarge { field: "waste tags", max: MAX_TAGS })
        );
    }

    #[test]
    fn tag_len_accepts_within_limit() {
        let env = Env::default();
        let tag = soroban_sdk::String::from_str(&env, "plastic");
        assert!(validate_tag_len(&tag).is_ok());
    }

    #[test]
    fn tag_len_rejects_too_long_tag() {
        let env = Env::default();
        let long = "x".repeat(MAX_TAG_LEN as usize + 1);
        let tag = soroban_sdk::String::from_str(&env, &long);
        assert!(matches!(
            validate_tag_len(&tag),
            Err(ValidationError::StringTooLong { field: "waste tag", .. })
        ));
    }
}
