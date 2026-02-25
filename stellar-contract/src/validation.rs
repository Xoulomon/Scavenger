use soroban_sdk::{Address, Env};

/// Input validation module for the Scavenger contract
/// Provides comprehensive validation for all user inputs

/// Validates that an amount is positive (greater than zero)
pub fn validate_positive_amount(amount: i128, field_name: &str) {
    if amount <= 0 {
        panic!("{} must be positive", field_name);
    }
}

/// Validates that a percentage is within valid range (0-100)
pub fn validate_percentage(percentage: u32, field_name: &str) {
    if percentage > 100 {
        panic!("{} must be <= 100", field_name);
    }
}

/// Validates that coordinates are within valid geographic ranges
/// Latitude: -90 to +90 degrees (stored as microdegrees: -90_000_000 to +90_000_000)
/// Longitude: -180 to +180 degrees (stored as microdegrees: -180_000_000 to +180_000_000)
pub fn validate_coordinates(latitude: i128, longitude: i128) {
    const MAX_LAT: i128 = 90_000_000;
    const MAX_LON: i128 = 180_000_000;

    if latitude < -MAX_LAT || latitude > MAX_LAT {
        panic!("Latitude must be between -90 and +90 degrees");
    }

    if longitude < -MAX_LON || longitude > MAX_LON {
        panic!("Longitude must be between -180 and +180 degrees");
    }
}

/// Validates that an address is not the contract itself
pub fn validate_address_not_contract(env: &Env, address: &Address) {
    if address == &env.current_contract_address() {
        panic!("Address cannot be the contract itself");
    }
}

/// Validates that two addresses are different
pub fn validate_addresses_different(addr1: &Address, addr2: &Address, context: &str) {
    if addr1 == addr2 {
        panic!("{}: addresses must be different", context);
    }
}

/// Validates that a u64 amount is positive (greater than zero)
pub fn validate_positive_u64(amount: u64, field_name: &str) {
    if amount == 0 {
        panic!("{} must be greater than zero", field_name);
    }
}

/// Validates that a u128 amount is positive (greater than zero)
pub fn validate_positive_u128(amount: u128, field_name: &str) {
    if amount == 0 {
        panic!("{} must be greater than zero", field_name);
    }
}
