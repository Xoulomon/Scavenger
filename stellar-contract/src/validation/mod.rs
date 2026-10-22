//! # Validation Utilities — Issue #757, split per-entity
//!
//! This module used to hold every validator for every contract entity
//! (participants, waste batches, transfers, percentages, coordinates, ...)
//! in one flat file, which made it hard to find entity-specific rules and to
//! test them in isolation. It is now split into:
//!
//! * [`mod@self`] — shared low-level primitives (amounts, percentages,
//!   coordinates, strings, timestamps, collections) used by every entity.
//! * [`participant`] — participant-registration rules.
//! * [`waste_batch`] — waste submission/batch rules.
//! * [`transfer`] — transfer and reward-split rules.
//!
//! The legacy helpers remain here under their original names but now emit
//! typed contract errors via `panic_with_error!` instead of string panics, so
//! existing call sites only need an `Env` argument. The per-entity modules
//! provide `Result`-returning wrappers using the shared [`ValidationError`]
//! type for callers that want to handle invalid input directly.

use soroban_sdk::{panic_with_error, Address, Env, String, Vec};

use crate::errors::Error;

pub mod participant;
pub mod transfer;
pub mod waste_batch;

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

/// Maximum number of tags per waste item.
pub const MAX_TAGS: u32 = 10;

/// Maximum tag length in characters.
pub const MAX_TAG_LEN: u32 = 32;

// ── Consistent error type for the new per-entity validators ────────────────────

/// Common error type returned by the `Result`-based validators in
/// [`participant`], [`waste_batch`], and [`transfer`], so callers get one
/// consistent error shape across entities instead of ad-hoc panics.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationError {
    /// A numeric value was zero/negative where a positive value was required.
    NotPositive { field: &'static str },
    /// A numeric value fell outside its allowed `[min, max]` range.
    OutOfRange { field: &'static str, min: i128, max: i128 },
    /// A percentage/bps value exceeded its maximum.
    PercentageTooHigh { field: &'static str },
    /// Two addresses that must differ were equal.
    AddressesNotDistinct { context: &'static str },
    /// An address was disallowed (e.g. equals the contract itself).
    AddressNotAllowed { context: &'static str },
    /// A string was empty where non-empty was required.
    EmptyString { field: &'static str },
    /// A string exceeded its maximum length.
    StringTooLong { field: &'static str, max_len: u32 },
    /// A collection was empty where non-empty was required.
    EmptyCollection { field: &'static str },
    /// A collection exceeded its maximum size.
    CollectionTooLarge { field: &'static str, max: u32 },
}

// ── Amount validators ─────────────────────────────────────────────────────────

/// Panics if `amount` is not positive (> 0).
#[allow(dead_code)]
pub fn validate_positive_amount(env: &Env, amount: i128, field_name: &str) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

/// Panics if `amount` is not positive (u128 variant, rejects zero).
pub fn validate_positive_u128(env: &Env, amount: u128, field_name: &str) {
    if amount == 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

/// Validates a waste weight in grams.
///
/// Panics if weight is below `MIN_WASTE_WEIGHT` (100 g) or above
/// `MAX_WASTE_WEIGHT` (1 000 000 kg).
pub fn validate_weight(env: &Env, weight: u128, field_name: &str) {
    if weight < MIN_WASTE_WEIGHT || weight > MAX_WASTE_WEIGHT {
        panic_with_error!(env, Error::InvalidWeight);
    }
}

/// Validates a waste/material weight: must be non-zero and within `max`.
///
/// Renamed from the original overlapping `validate_weight(weight, max)` to
/// avoid a duplicate-definition conflict with the field-name variant above;
/// callers passing an explicit ceiling (rather than the global
/// `MAX_WASTE_WEIGHT` constant) should use this.
pub fn validate_weight_max(env: &Env, weight: u128, max: u128) {
    validate_positive_u128(env, weight, "Waste weight");
    if weight > max {
        panic_with_error!(env, Error::InvalidWeight);
    }
}

/// Validates a non-negative i128 token amount (allows 0).
#[allow(dead_code)]
pub fn validate_non_negative(env: &Env, amount: i128, field_name: &str) {
    if amount < 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

// ── Percentage validators ─────────────────────────────────────────────────────

/// Panics if `percentage` is greater than 100.
pub fn validate_percentage(env: &Env, percentage: u32, field_name: &str) {
    if percentage > 100 {
        panic_with_error!(env, Error::InvalidPercentage);
    }
}

/// Validates that two reward-distribution percentages don't sum past 100.
pub fn validate_percentage_sum(env: &Env, collector_percentage: u32, owner_percentage: u32) {
    if collector_percentage + owner_percentage > 100 {
        panic_with_error!(env, Error::InvalidPercentage);
    }
}

/// Validates that collector and owner percentages together do not exceed 100.
pub fn validate_reward_percentages(env: &Env, collector_pct: u32, owner_pct: u32) {
    if collector_pct + owner_pct > 100 {
        panic_with_error!(env, Error::InvalidPercentage);
    }
}

/// Validates a basis-point value (0–10 000 = 0%–100%).
#[allow(dead_code)]
pub fn validate_bps(env: &Env, bps: u32, field_name: &str) {
    if bps > 10_000 {
        panic_with_error!(env, Error::InvalidPercentage);
    }
}

// ── Coordinate validators ─────────────────────────────────────────────────────

/// Validates WGS-84 coordinates stored as microdegrees.
pub fn validate_coordinates(env: &Env, latitude: i128, longitude: i128) {
    if !(-MAX_LAT..=MAX_LAT).contains(&latitude) || !(-MAX_LON..=MAX_LON).contains(&longitude) {
        panic_with_error!(env, Error::InvalidCoordinates);
    }
}

// ── Address validators ────────────────────────────────────────────────────────

/// Panics if `address` equals the current contract address.
pub fn validate_address_not_contract(env: &Env, address: &Address) {
    if address == &env.current_contract_address() {
        panic_with_error!(env, Error::SameAddress);
    }
}

/// Panics if `addr1` equals `addr2`.
pub fn validate_addresses_different(env: &Env, addr1: &Address, addr2: &Address, _context: &str) {
    if addr1 == addr2 {
        panic_with_error!(env, Error::SameAddress);
    }
}

/// Panics if `address` is not present in `allowed`.
#[allow(dead_code)]
pub fn validate_address_in_list(env: &Env, address: &Address, allowed: &Vec<Address>, _context: &str) {
    if !allowed.contains(address) {
        panic_with_error!(env, Error::Unauthorized);
    }
}

// ── String validators ─────────────────────────────────────────────────────────

/// Panics if the Soroban `String` is empty.
pub fn validate_string_not_empty(env: &Env, s: &String, field_name: &str) {
    if s.len() == 0 {
        panic_with_error!(env, Error::InvalidInput);
    }
}

/// Panics if the Soroban `String` exceeds `max_len` characters.
pub fn validate_string_max_len(env: &Env, s: &String, max_len: u32, field_name: &str) {
    if s.len() > max_len {
        panic_with_error!(env, Error::InvalidInput);
    }
}

/// Convenience: validates both non-empty and max length.
#[allow(dead_code)]
pub fn validate_string(env: &Env, s: &String, max_len: u32, field_name: &str) {
    validate_string_not_empty(env, s, field_name);
    validate_string_max_len(env, s, max_len, field_name);
}

// ── Timestamp validators ──────────────────────────────────────────────────────

/// Panics if `timestamp` is not strictly in the future.
#[allow(dead_code)]
pub fn validate_future_timestamp(env: &Env, timestamp: u64, current_time: u64, field_name: &str) {
    if timestamp <= current_time {
        panic_with_error!(env, Error::InvalidSchedule);
    }
}

/// Panics if `end` is not strictly after `start`.
#[allow(dead_code)]
pub fn validate_time_range(env: &Env, start: u64, end: u64) {
    if end <= start {
        panic_with_error!(env, Error::InvalidSchedule);
    }
}

// ── Collection validators ─────────────────────────────────────────────────────

/// Panics if a `Vec` is empty.
#[allow(dead_code)]
pub fn validate_not_empty_collection(env: &Env, len: u32, field_name: &str) {
    if len == 0 {
        panic_with_error!(env, Error::InvalidInput);
    }
}

/// Panics if a `Vec` length exceeds `max`.
#[allow(dead_code)]
pub fn validate_max_collection_size(env: &Env, len: u32, max: u32, field_name: &str) {
    if len > max {
        panic_with_error!(env, Error::InvalidInput);
    }
}

// ── Composite validators kept for backward compatibility ───────────────────────
//
// Prefer `waste_batch::validate_waste_submission` / `participant::validate_registration`
// for new code — these delegate to the same logic and remain so existing call
// sites are unaffected.

/// Full validation for a waste submission (weight range + coordinates).
pub fn validate_waste_submission(weight: u128, latitude: i128, longitude: i128) {
    validate_weight(weight, "waste weight");
    validate_coordinates(latitude, longitude);
}

/// Full validation for participant registration.
pub fn validate_participant_registration(env: &Env, address: &Address, latitude: i128, longitude: i128) {
    validate_address_not_contract(env, address);
    validate_coordinates(latitude, longitude);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    // ── Amount tests ──────────────────────────────────────────────────────────

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
    fn non_negative_accepts_zero_and_positive() {
        validate_non_negative(0, "amount");
        validate_non_negative(100, "amount");
    }

    #[test]
    #[should_panic(expected = "amount cannot be negative")]
    fn non_negative_rejects_negative() {
        validate_non_negative(-1, "amount");
    }

    // ── Weight tests ──────────────────────────────────────────────────────────

    #[test]
    fn weight_accepts_valid_range() {
        validate_weight(MIN_WASTE_WEIGHT, "weight");
        validate_weight(1_000, "weight");
        validate_weight(MAX_WASTE_WEIGHT, "weight");
    }

    #[test]
    #[should_panic(expected = "must be at least")]
    fn weight_rejects_below_minimum() {
        validate_weight(99, "waste weight");
    }

    #[test]
    #[should_panic(expected = "must not exceed")]
    fn weight_rejects_above_maximum() {
        validate_weight(MAX_WASTE_WEIGHT + 1, "waste weight");
    }

    #[test]
    fn weight_max_accepts_value_within_ceiling() {
        validate_weight_max(50, 100);
    }

    #[test]
    #[should_panic(expected = "exceeds maximum allowed")]
    fn weight_max_rejects_value_over_ceiling() {
        validate_weight_max(101, 100);
    }

    // ── Percentage tests ──────────────────────────────────────────────────────

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
    fn reward_percentages_accepts_valid_split() {
        validate_reward_percentages(30, 50);
        validate_reward_percentages(0, 100);
        validate_reward_percentages(50, 50);
    }

    #[test]
    #[should_panic(expected = "Total percentages cannot exceed 100")]
    fn reward_percentages_rejects_over_100() {
        validate_reward_percentages(60, 50);
    }

    #[test]
    #[should_panic(expected = "Total percentages cannot exceed 100")]
    fn percentage_sum_rejects_over_100() {
        validate_percentage_sum(60, 50);
    }

    #[test]
    fn bps_accepts_boundary_values() {
        validate_bps(0, "fee");
        validate_bps(10_000, "fee");
    }

    #[test]
    #[should_panic(expected = "must be <= 10 000 basis points")]
    fn bps_rejects_over_max() {
        validate_bps(10_001, "fee");
    }

    // ── Coordinate tests ──────────────────────────────────────────────────────

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

    #[test]
    fn address_not_contract_accepts_other_address() {
        let env = Env::default();
        let a = soroban_sdk::Address::generate(&env);
        validate_address_not_contract(&env, &a);
    }

    #[test]
    fn address_in_list_accepts_member() {
        let env = Env::default();
        let a = soroban_sdk::Address::generate(&env);
        let list = Vec::from_array(&env, [a.clone()]);
        validate_address_in_list(&a, &list, "admin");
    }

    #[test]
    #[should_panic(expected = "admin: address not authorised")]
    fn address_in_list_rejects_non_member() {
        let env = Env::default();
        let a = soroban_sdk::Address::generate(&env);
        let b = soroban_sdk::Address::generate(&env);
        let list = Vec::from_array(&env, [a]);
        validate_address_in_list(&b, &list, "admin");
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

    // ── Timestamp tests ───────────────────────────────────────────────────────

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
    fn time_range_accepts_end_after_start() {
        validate_time_range(100, 200);
    }

    #[test]
    #[should_panic(expected = "End time must be after start time")]
    fn time_range_rejects_end_before_start() {
        validate_time_range(200, 100);
    }

    #[test]
    #[should_panic(expected = "End time must be after start time")]
    fn time_range_rejects_equal_start_and_end() {
        validate_time_range(100, 100);
    }

    // ── String tests ──────────────────────────────────────────────────────────

    #[test]
    fn string_not_empty_accepts_non_empty() {
        let env = Env::default();
        let s = soroban_sdk::String::from_str(&env, "hello");
        validate_string_not_empty(&s, "name");
    }

    #[test]
    #[should_panic(expected = "name must not be empty")]
    fn string_not_empty_rejects_empty() {
        let env = Env::default();
        let s = soroban_sdk::String::from_str(&env, "");
        validate_string_not_empty(&s, "name");
    }

    #[test]
    fn string_max_len_accepts_within_limit() {
        let env = Env::default();
        let s = soroban_sdk::String::from_str(&env, "hello");
        validate_string_max_len(&s, 10, "name");
    }

    #[test]
    #[should_panic(expected = "must not exceed")]
    fn string_max_len_rejects_too_long() {
        let env = Env::default();
        let s = soroban_sdk::String::from_str(&env, "this is way too long");
        validate_string_max_len(&s, 5, "name");
    }

    #[test]
    fn string_convenience_accepts_valid_string() {
        let env = Env::default();
        let s = soroban_sdk::String::from_str(&env, "ok");
        validate_string(&s, 10, "name");
    }

    // ── Collection tests ──────────────────────────────────────────────────────

    #[test]
    fn not_empty_collection_accepts_nonzero_len() {
        validate_not_empty_collection(1, "tags");
    }

    #[test]
    #[should_panic(expected = "tags must not be empty")]
    fn not_empty_collection_rejects_zero_len() {
        validate_not_empty_collection(0, "tags");
    }

    #[test]
    fn max_collection_size_accepts_within_limit() {
        validate_max_collection_size(5, 10, "tags");
    }

    #[test]
    #[should_panic(expected = "tags must not exceed 10 items")]
    fn max_collection_size_rejects_over_limit() {
        validate_max_collection_size(11, 10, "tags");
    }
}
