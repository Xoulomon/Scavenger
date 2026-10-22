//! Shared validators for contract input, addresses, and resource constraints.
//!
//! The public functions remain available through `crate::validation`, while
//! implementation is split by concern across this directory.

mod addresses;
mod amounts;
mod paths;
mod weights;

pub use addresses::{validate_address_in_list, validate_address_not_contract, validate_addresses_different};
pub use amounts::{
    validate_bps, validate_non_negative, validate_percentage, validate_percentage_sum, validate_positive_amount,
    validate_positive_u128, validate_reward_percentages,
};
pub use paths::{
    validate_coordinates, validate_future_timestamp, validate_max_collection_size, validate_not_empty_collection,
    validate_participant_registration, validate_string, validate_string_max_len, validate_string_not_empty,
    validate_time_range, MAX_LAT, MAX_LON, MAX_NAME_LEN, MAX_NOTE_LEN, MAX_TAGS, MAX_TAG_LEN,
};
pub use weights::{validate_waste_submission, validate_weight, MAX_WASTE_WEIGHT, MIN_WASTE_WEIGHT};

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn positive_amount_accepts_valid_value() {
        validate_positive_amount(1, "amount");
        validate_positive_amount(i128::MAX, "amount");
    }

    #[test]
    #[should_panic(expected = "amount must be greater than zero")]
    fn positive_amount_rejects_zero() {
        validate_positive_amount(0, "amount");
    }

    #[test]
    #[should_panic(expected = "amount must be greater than zero")]
    fn positive_amount_rejects_negative() {
        validate_positive_amount(-1, "amount");
    }

    #[test]
    fn positive_u128_accepts_valid_value() {
        validate_positive_u128(1, "value");
    }

    #[test]
    #[should_panic(expected = "value must be greater than zero")]
    fn positive_u128_rejects_zero() {
        validate_positive_u128(0, "value");
    }

    #[test]
    fn weight_accepts_valid_range() {
        validate_weight(MIN_WASTE_WEIGHT, MAX_WASTE_WEIGHT);
        validate_weight(1_000, MAX_WASTE_WEIGHT);
        validate_weight(MAX_WASTE_WEIGHT, MAX_WASTE_WEIGHT);
    }

    #[test]
    #[should_panic(expected = "must be at least")]
    fn weight_rejects_below_minimum() {
        validate_weight(99, MAX_WASTE_WEIGHT);
    }

    #[test]
    #[should_panic(expected = "must not exceed")]
    fn weight_rejects_above_maximum() {
        validate_weight(MAX_WASTE_WEIGHT + 1, MAX_WASTE_WEIGHT);
    }

    #[test]
    fn percentage_accepts_valid_values() {
        validate_percentage(0, "pct");
        validate_percentage(50, "pct");
        validate_percentage(100, "pct");
    }

    #[test]
    #[should_panic(expected = "pct must be <= 100")]
    fn percentage_rejects_over_100() {
        validate_percentage(101, "pct");
    }

    #[test]
    fn reward_percentages_accept_valid_split() {
        validate_reward_percentages(30, 50);
        validate_reward_percentages(0, 100);
        validate_reward_percentages(50, 50);
    }

    #[test]
    #[should_panic(expected = "Total percentages cannot exceed 100")]
    fn reward_percentages_reject_over_100() {
        validate_reward_percentages(60, 50);
    }

    #[test]
    #[should_panic(expected = "Total percentages cannot exceed 100")]
    fn reward_percentages_reject_out_of_range_input() {
        validate_percentage_sum(u32::MAX, 0);
    }

    #[test]
    fn coordinates_accept_valid_values() {
        validate_coordinates(0, 0);
        validate_coordinates(MAX_LAT, MAX_LON);
        validate_coordinates(-MAX_LAT, -MAX_LON);
        validate_coordinates(52_520_000, 13_405_000);
    }

    #[test]
    #[should_panic(expected = "Latitude must be between -90 and +90 degrees")]
    fn coordinates_reject_invalid_latitude() {
        validate_coordinates(91_000_000, 0);
    }

    #[test]
    #[should_panic(expected = "Longitude must be between -180 and +180 degrees")]
    fn coordinates_reject_invalid_longitude() {
        validate_coordinates(0, 181_000_000);
    }

    #[test]
    #[should_panic(expected = "Latitude must be between -90 and +90 degrees")]
    fn coordinates_reject_negative_lat_out_of_range() {
        validate_coordinates(-91_000_000, 0);
    }

    #[test]
    fn addresses_different_accepts_different_addresses() {
        let env = Env::default();
        let a = soroban_sdk::Address::generate(&env);
        let b = soroban_sdk::Address::generate(&env);
        validate_addresses_different(&a, &b, "transfer");
    }

    #[test]
    #[should_panic(expected = "transfer: addresses must be different")]
    fn addresses_different_rejects_same_address() {
        let env = Env::default();
        let a = soroban_sdk::Address::generate(&env);
        validate_addresses_different(&a, &a, "transfer");
    }

    #[test]
    fn waste_submission_validates_all_fields() {
        validate_waste_submission(1_000, 52_520_000, 13_405_000);
    }

    #[test]
    #[should_panic(expected = "must be at least")]
    fn waste_submission_rejects_low_weight() {
        validate_waste_submission(10, 0, 0);
    }

    #[test]
    #[should_panic(expected = "Latitude must be between")]
    fn waste_submission_rejects_bad_coordinates() {
        validate_waste_submission(1_000, 999_000_000, 0);
    }

    #[test]
    fn future_timestamp_accepts_future_time() {
        validate_future_timestamp(1_000, 500, "deadline");
    }

    #[test]
    #[should_panic(expected = "deadline must be in the future")]
    fn future_timestamp_rejects_past() {
        validate_future_timestamp(500, 1_000, "deadline");
    }

    #[test]
    #[should_panic(expected = "deadline must be in the future")]
    fn future_timestamp_rejects_equal() {
        validate_future_timestamp(1_000, 1_000, "deadline");
    }

    #[test]
    fn string_not_empty_accepts_non_empty() {
        let env = Env::default();
        let value = soroban_sdk::String::from_str(&env, "hello");
        validate_string_not_empty(&value, "name");
    }

    #[test]
    #[should_panic(expected = "name must not be empty")]
    fn string_not_empty_rejects_empty() {
        let env = Env::default();
        let value = soroban_sdk::String::from_str(&env, "");
        validate_string_not_empty(&value, "name");
    }
}
