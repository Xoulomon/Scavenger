//! # Validation Utilities — Issue #757
//!
//! This module contains security-sensitive validation helpers. Because these
//! functions guard against malformed or malicious input, their tests are
//! exercised by the mutation-testing pilot (see `MUTATION_TESTING.md`).
//!
//! ## Usage
//!
//! ```ignore
//! use crate::validation::{
//!     validate_positive_amount, validate_weight, validate_coordinates,
//!     validate_percentage, validate_addresses_different,
//! };
//!
//! validate_weight(weight, MAX_WASTE_WEIGHT);
//! validate_coordinates(latitude, longitude);
//! validate_percentage(collector_pct, "collector_percentage");
//! ```

use soroban_sdk::{Address, Env, String, Vec};

// ── Constants ─────────────────────────────────────────────────────────────────

/// Maximum latitude in microdegrees (90°).
pub const MAX_LAT: i128 = 90_000_000;

/// Maximum longitude in microdegrees (180°).
pub const MAX_LON: i128 = 180_000_000;

/// Maximum waste weight per submission in grams (1 000 000 kg).
pub const MAX_WASTE_WEIGHT: u128 = 1_000_000_000;

/// Minimum waste weight per submission in grams (100 g).
pub const MIN_WASTE_WEIGHT: u128 = 100;

/// Maximum string length for participant display name.
pub const MAX_NAME_LEN: u32 = 64;

/// Maximum note/memo length on transfers.
pub const MAX_NOTE_LEN: u32 = 256;

/// Maximum length allowed for a user-supplied identifier.
pub const MAX_IDENTIFIER_LEN: usize = 64;

/// Minimum length allowed for a user-supplied identifier.
pub const MIN_IDENTIFIER_LEN: usize = 3;

/// Errors returned by the validation helpers.
#[derive(Debug, PartialEq, Eq)]
pub enum ValidationError {
    Empty,
    TooShort,
    TooLong,
    InvalidCharacter(char),
    ZeroAmount,
    AmountTooLarge,
}

/// Validates a waste weight in grams, bounded by `max`.
///
/// Panics if weight is below `MIN_WASTE_WEIGHT` (100 g) or above
/// `max`.
///
/// # Parameters
/// * `weight` — weight in grams.
/// * `max`    — maximum accepted weight in grams.
///
/// # Example
/// ```ignore
/// validate_weight(waste.weight, MAX_WASTE_WEIGHT);
/// ```
pub fn validate_weight(weight: u128, max: u128) {
    validate_positive_u128(weight, "Waste weight");
    if weight < MIN_WASTE_WEIGHT {
        panic!("Waste weight must be at least {} grams", MIN_WASTE_WEIGHT);
    }
    if weight > max {
        panic!("Waste weight must not exceed {} grams", max);
    }
}

/// Validates that two reward-distribution percentages don't sum past 100.
pub fn validate_percentage_sum(collector_percentage: u32, owner_percentage: u32) {
    if collector_percentage > 100 || owner_percentage > 100 || collector_percentage + owner_percentage > 100 {
        panic!("Total percentages cannot exceed 100");
    }
}

/// Validates a non-negative i128 token amount (allows 0).
#[allow(dead_code)]
pub fn validate_non_negative(amount: i128, field_name: &str) {
    if amount < 0 {
        panic!("{} cannot be negative", field_name);
    }
}

// ── Percentage validators ─────────────────────────────────────────────────────

/// Panics if `percentage` is greater than 100.
///
/// # Parameters
/// * `percentage` — value to validate (0–100).
/// * `field_name` — name used in the panic message.
pub fn validate_percentage(percentage: u32, field_name: &str) {
    if percentage > 100 {
        panic!("{} must be <= 100", field_name);
    }
}

/// Validates a basis-point value (0–10 000 = 0%–100%).
///
/// # Parameters
/// * `bps`        — basis points to validate.
/// * `field_name` — name used in the panic message.
#[allow(dead_code)]
pub fn validate_bps(bps: u32, field_name: &str) {
    if bps > 10_000 {
        panic!("{} must be <= 10 000 basis points", field_name);
    }
}

// ── Coordinate validators ─────────────────────────────────────────────────────

/// Validates WGS-84 coordinates stored as microdegrees.
///
/// * Latitude  must be in `[-90_000_000, 90_000_000]`  (i.e. −90° to +90°).
/// * Longitude must be in `[-180_000_000, 180_000_000]` (i.e. −180° to +180°).
///
/// # Panics
/// Panics with a descriptive message if either value is out of range.
///
/// # Example
/// ```ignore
/// validate_coordinates(52_520_000, 13_405_000); // Berlin, valid
/// validate_coordinates(91_000_000, 0);           // panics
/// ```
pub fn validate_coordinates(latitude: i128, longitude: i128) {
    if !(-MAX_LAT..=MAX_LAT).contains(&latitude) {
        panic!("Latitude must be between -90 and +90 degrees");
    }
    if !(-MAX_LON..=MAX_LON).contains(&longitude) {
        panic!("Longitude must be between -180 and +180 degrees");
    }
}

// ── Address validators ────────────────────────────────────────────────────────

/// Panics if `address` equals the current contract address.
///
/// Use this to prevent participants from registering as the contract itself.
///
/// # Parameters
/// * `env`     — Soroban environment.
/// * `address` — address to check.
pub fn validate_address_not_contract(env: &Env, address: &Address) {
    if address == &env.current_contract_address() {
        panic!("Address cannot be the contract itself");
    }
}

/// Panics if `addr1` equals `addr2`.
///
/// # Parameters
/// * `addr1`   — first address.
/// * `addr2`   — second address.
/// * `context` — description used in the panic message.
///
/// # Example
/// ```ignore
/// validate_addresses_different(&from, &to, "waste transfer");
/// ```
pub fn validate_addresses_different(addr1: &Address, addr2: &Address, context: &str) {
    if addr1 == addr2 {
        panic!("{}: addresses must be different", context);
    }
}

/// Panics if `address` is not present in `allowed`.
///
/// Use to verify a caller is in the admin list or member set.
///
/// # Parameters
/// * `address` — address to check.
/// * `allowed` — list of permitted addresses.
/// * `context` — description used in the panic message.
#[allow(dead_code)]
pub fn validate_address_in_list(address: &Address, allowed: &Vec<Address>, context: &str) {
    if !allowed.contains(address) {
        panic!("{}: address not authorised", context);
    }
}

// ── String validators ─────────────────────────────────────────────────────────

/// Panics if the Soroban `String` is empty.
///
/// # Parameters
/// * `s`          — string to check.
/// * `field_name` — name used in the panic message.
pub fn validate_string_not_empty(s: &String, field_name: &str) {
    if s.len() == 0 {
        panic!("{} must not be empty", field_name);
    }
}

/// Panics if the Soroban `String` exceeds `max_len` characters.
///
/// # Parameters
/// * `s`          — string to check.
/// * `max_len`    — maximum allowed length.
/// * `field_name` — name used in the panic message.
pub fn validate_string_max_len(s: &String, max_len: u32, field_name: &str) {
    if s.len() > max_len {
        panic!("{} must not exceed {} characters", field_name, max_len);
    }

    for ch in input.chars() {
        if !(ch.is_ascii_alphanumeric() || ch == '_') {
            return Err(ValidationError::InvalidCharacter(ch));
        }
    }

    Ok(())
}

/// Maximum amount accepted by [`validate_amount`].
pub const MAX_AMOUNT: u64 = 1_000_000_000_000;

/// Validates a transfer amount.
///
/// Amounts must be strictly greater than zero and must not exceed
/// [`MAX_AMOUNT`].
pub fn validate_amount(amount: u64) -> Result<(), ValidationError> {
    if amount == 0 {
        return Err(ValidationError::ZeroAmount);
    }
    if amount > MAX_AMOUNT {
        return Err(ValidationError::AmountTooLarge);
    }
    Ok(())
}

// ── Waste-specific composite validators ───────────────────────────────────────

/// Full validation for a waste submission.
///
/// Checks weight range and coordinates in a single call.
///
/// # Parameters
/// * `weight`    — weight in grams.
/// * `latitude`  — latitude in microdegrees.
/// * `longitude` — longitude in microdegrees.
///
/// # Example
/// ```ignore
/// validate_waste_submission(weight, latitude, longitude);
/// ```
pub fn validate_waste_submission(weight: u128, latitude: i128, longitude: i128) {
    validate_weight(weight, MAX_WASTE_WEIGHT);
    validate_coordinates(latitude, longitude);
}

/// Full validation for participant registration.
///
/// Checks that the address is not the contract itself and coordinates are valid.
///
/// # Parameters
/// * `env`       — Soroban environment.
/// * `address`   — registering address.
/// * `latitude`  — latitude in microdegrees.
/// * `longitude` — longitude in microdegrees.
pub fn validate_participant_registration(env: &Env, address: &Address, latitude: i128, longitude: i128) {
    validate_address_not_contract(env, address);
    validate_coordinates(latitude, longitude);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_identifier() {
        assert_eq!(validate_identifier("abc"), Ok(()));
        assert_eq!(validate_identifier("user_123"), Ok(()));
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
    fn accepts_identifier_at_min_length() {
        // Boundary: exactly MIN_IDENTIFIER_LEN must be accepted.
        assert_eq!(validate_identifier("abc"), Ok(()));
    }

    #[test]
    #[should_panic(expected = "value must be greater than zero")]
    fn positive_u128_rejects_zero() {
        validate_positive_u128(0, "value");
    }

    // ── Weight tests ──────────────────────────────────────────────────────────

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

    // ── Percentage tests ──────────────────────────────────────────────────────

    #[test]
    fn percentage_accepts_valid_values() {
        validate_percentage(0, "pct");
        validate_percentage(50, "pct");
        validate_percentage(100, "pct");
    }

    #[test]
    fn rejects_identifier_above_max_length() {
        // Kills mutants that relax the `> MAX_IDENTIFIER_LEN` boundary.
        let input = "a".repeat(MAX_IDENTIFIER_LEN + 1);
        assert_eq!(validate_identifier(&input), Err(ValidationError::TooLong));
    }

    #[test]
    fn reward_percentages_accepts_valid_split() {
        validate_percentage_sum(30, 50);
        validate_percentage_sum(0, 100);
        validate_percentage_sum(50, 50);
    }

    #[test]
    #[should_panic(expected = "Total percentages cannot exceed 100")]
    fn reward_percentages_rejects_over_100() {
        validate_percentage_sum(60, 50);
    }

    #[test]
    #[should_panic(expected = "Total percentages cannot exceed 100")]
    fn reward_percentages_reject_out_of_range_input() {
        validate_percentage_sum(u32::MAX, 0);
    }

    // ── Coordinate tests ──────────────────────────────────────────────────────

    #[test]
    fn coordinates_accept_valid_values() {
        validate_coordinates(0, 0);
        validate_coordinates(MAX_LAT, MAX_LON);
        validate_coordinates(-MAX_LAT, -MAX_LON);
        validate_coordinates(52_520_000, 13_405_000); // Berlin
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

    // ── Address tests ─────────────────────────────────────────────────────────

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

    // ── Composite tests ───────────────────────────────────────────────────────

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
    fn rejects_zero_amount() {
        assert_eq!(validate_amount(0), Err(ValidationError::ZeroAmount));
    }

    #[test]
    fn accepts_minimum_positive_amount() {
        // Kills mutants that change `amount == 0` to `amount <= 0`-style logic.
        assert_eq!(validate_amount(1), Ok(()));
    }

    #[test]
    fn accepts_amount_at_max() {
        // Boundary: exactly MAX_AMOUNT must be accepted.
        assert_eq!(validate_amount(MAX_AMOUNT), Ok(()));
    }

    #[test]
    fn rejects_amount_above_max() {
        // Kills mutants that relax the `> MAX_AMOUNT` boundary.
        assert_eq!(
            validate_amount(MAX_AMOUNT + 1),
            Err(ValidationError::AmountTooLarge)
        );
    }
}
