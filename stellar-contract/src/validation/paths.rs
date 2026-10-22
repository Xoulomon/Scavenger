use soroban_sdk::{Address, Env, String};

use super::addresses::validate_address_not_contract;

/// Maximum latitude in microdegrees (90 degrees).
pub const MAX_LAT: i128 = 90_000_000;

/// Maximum longitude in microdegrees (180 degrees).
pub const MAX_LON: i128 = 180_000_000;

/// Maximum string length for participant display name.
pub const MAX_NAME_LEN: u32 = 64;

/// Maximum note/memo length on transfers.
pub const MAX_NOTE_LEN: u32 = 256;

/// Maximum number of tags per waste item.
pub const MAX_TAGS: u32 = 10;

/// Maximum tag length in characters.
pub const MAX_TAG_LEN: u32 = 32;

/// Validates WGS-84 coordinates stored as microdegrees.
pub fn validate_coordinates(latitude: i128, longitude: i128) {
    if !(-MAX_LAT..=MAX_LAT).contains(&latitude) {
        panic!("Latitude must be between -90 and +90 degrees");
    }
    if !(-MAX_LON..=MAX_LON).contains(&longitude) {
        panic!("Longitude must be between -180 and +180 degrees");
    }
}

/// Panics if the Soroban `String` is empty.
pub fn validate_string_not_empty(value: &String, field_name: &str) {
    if value.len() == 0 {
        panic!("{} must not be empty", field_name);
    }
}

/// Panics if the Soroban `String` exceeds `max_len` characters.
pub fn validate_string_max_len(value: &String, max_len: u32, field_name: &str) {
    if value.len() > max_len {
        panic!("{} must not exceed {} characters", field_name, max_len);
    }
}

/// Validates that a Soroban `String` is non-empty and within the maximum length.
#[allow(dead_code)]
pub fn validate_string(value: &String, max_len: u32, field_name: &str) {
    validate_string_not_empty(value, field_name);
    validate_string_max_len(value, max_len, field_name);
}

/// Panics if `timestamp` is not strictly in the future.
#[allow(dead_code)]
pub fn validate_future_timestamp(timestamp: u64, current_time: u64, field_name: &str) {
    if timestamp <= current_time {
        panic!("{} must be in the future", field_name);
    }
}

/// Panics if `end` is not strictly after `start`.
#[allow(dead_code)]
pub fn validate_time_range(start: u64, end: u64) {
    if end <= start {
        panic!("End time must be after start time");
    }
}

/// Panics if a collection is empty.
#[allow(dead_code)]
pub fn validate_not_empty_collection(len: u32, field_name: &str) {
    if len == 0 {
        panic!("{} must not be empty", field_name);
    }
}

/// Panics if a collection length exceeds `max`.
#[allow(dead_code)]
pub fn validate_max_collection_size(len: u32, max: u32, field_name: &str) {
    if len > max {
        panic!("{} must not exceed {} items", field_name, max);
    }
}

/// Validates an address and coordinates for participant registration.
pub fn validate_participant_registration(env: &Env, address: &Address, latitude: i128, longitude: i128) {
    validate_address_not_contract(env, address);
    validate_coordinates(latitude, longitude);
}
