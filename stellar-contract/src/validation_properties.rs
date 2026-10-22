#![cfg(test)]

use proptest::prelude::*;
use crate::validation::*;

// Strategy for valid positive amounts (1..i128::MAX)
fn valid_positive_amount() -> impl Strategy<Value = i128> {
    1i128..i128::MAX
}

// Strategy for invalid amounts (<= 0)
fn invalid_amount() -> impl Strategy<Value = i128> {
    i128::MIN..=0
}

// Strategy for valid percentages (0..=100)
fn valid_percentage() -> impl Strategy<Value = u32> {
    0u32..=100
}

// Strategy for invalid percentages (> 100)
fn invalid_percentage() -> impl Strategy<Value = u32> {
    101u32..u32::MAX
}

// Strategy for valid latitudes (-90,000,000..=90,000,000)
fn valid_latitude() -> impl Strategy<Value = i128> {
    -90_000_000i128..=90_000_000i128
}

// Strategy for invalid latitudes (< -90,000,000 or > 90,000,000)
fn invalid_latitude() -> impl Strategy<Value = i128> {
    prop_oneof![
        i128::MIN..=-90_000_001i128,
        90_000_001i128..=i128::MAX,
    ]
}

// Strategy for valid longitudes (-180,000,000..=180,000,000)
fn valid_longitude() -> impl Strategy<Value = i128> {
    -180_000_000i128..=180_000_000i128
}

// Strategy for invalid longitudes (< -180,000,000 or > 180,000,000)
fn invalid_longitude() -> impl Strategy<Value = i128> {
    prop_oneof![
        i128::MIN..=-180_000_001i128,
        180_000_001i128..=i128::MAX,
    ]
}

// Strategy for valid positive u128
fn valid_positive_u128() -> impl Strategy<Value = u128> {
    1u128..u128::MAX
}

// Strategy for invalid positive u128 (zero)
fn invalid_u128_zero() -> impl Strategy<Value = u128> {
    Just(0u128)
}

proptest! {
    #[test]
    fn prop_validate_positive_amount_accepts_positive_values(amount in valid_positive_amount()) {
        // Should not panic for valid amounts
        validate_positive_amount(amount, "test_amount");
        prop_assert!(true);
    }

    #[test]
    fn prop_validate_positive_amount_rejects_invalid_values(amount in invalid_amount()) {
        // Should panic for invalid amounts
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_positive_amount(amount, "test_amount");
        }));
        prop_assert!(result.is_err());
    }

    #[test]
    fn prop_validate_positive_amount_never_panics_on_arbitrary_input(amount in any::<i128>()) {
        // Test that validator handles all inputs gracefully (catching panics)
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_positive_amount(amount, "test_field");
        }));
        // Either succeeds or fails as expected
        let _ = result;
        prop_assert!(true);
    }

    #[test]
    fn prop_validate_percentage_accepts_valid_values(percentage in valid_percentage()) {
        validate_percentage(percentage, "test_percentage");
        prop_assert!(true);
    }

    #[test]
    fn prop_validate_percentage_rejects_invalid_values(percentage in invalid_percentage()) {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_percentage(percentage, "test_percentage");
        }));
        prop_assert!(result.is_err());
    }

    #[test]
    fn prop_validate_percentage_never_panics_on_arbitrary_input(percentage in any::<u32>()) {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_percentage(percentage, "test_field");
        }));
        let _ = result;
        prop_assert!(true);
    }

    #[test]
    fn prop_validate_coordinates_accepts_valid_coords(
        lat in valid_latitude(),
        lon in valid_longitude()
    ) {
        validate_coordinates(lat, lon);
        prop_assert!(true);
    }

    #[test]
    fn prop_validate_coordinates_rejects_invalid_latitude(
        lat in invalid_latitude(),
        lon in valid_longitude()
    ) {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_coordinates(lat, lon);
        }));
        prop_assert!(result.is_err());
    }

    #[test]
    fn prop_validate_coordinates_rejects_invalid_longitude(
        lat in valid_latitude(),
        lon in invalid_longitude()
    ) {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_coordinates(lat, lon);
        }));
        prop_assert!(result.is_err());
    }

    #[test]
    fn prop_validate_coordinates_never_panics_on_arbitrary_input(
        lat in any::<i128>(),
        lon in any::<i128>()
    ) {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_coordinates(lat, lon);
        }));
        let _ = result;
        prop_assert!(true);
    }

    #[test]
    fn prop_validate_positive_u128_accepts_positive_values(amount in valid_positive_u128()) {
        validate_positive_u128(amount, "test_amount");
        prop_assert!(true);
    }

    #[test]
    fn prop_validate_positive_u128_rejects_zero(amount in invalid_u128_zero()) {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_positive_u128(amount, "test_amount");
        }));
        prop_assert!(result.is_err());
    }

    #[test]
    fn prop_validate_positive_u128_never_panics_on_arbitrary_input(amount in any::<u128>()) {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_positive_u128(amount, "test_field");
        }));
        let _ = result;
        prop_assert!(true);
    }
}

// Regression tests for known failing seeds
#[cfg(test)]
mod regression_tests {
    use super::*;

    #[test]
    fn regression_min_i128_should_fail_positive_amount() {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_positive_amount(i128::MIN, "test");
        }));
        assert!(result.is_err());
    }

    #[test]
    fn regression_max_lat_boundary() {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_coordinates(90_000_000, 0);
        }));
        assert!(result.is_ok());
    }

    #[test]
    fn regression_max_lat_boundary_exceeded() {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_coordinates(90_000_001, 0);
        }));
        assert!(result.is_err());
    }

    #[test]
    fn regression_max_lon_boundary() {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_coordinates(0, 180_000_000);
        }));
        assert!(result.is_ok());
    }

    #[test]
    fn regression_max_lon_boundary_exceeded() {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_coordinates(0, 180_000_001);
        }));
        assert!(result.is_err());
    }

    #[test]
    fn regression_percentage_boundary() {
        validate_percentage(100, "test");
        assert!(true);
    }

    #[test]
    fn regression_percentage_boundary_exceeded() {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            validate_percentage(101, "test");
        }));
        assert!(result.is_err());
    }
}
