//! Participant-specific validation rules.
//!
//! Split out of the monolithic `validation.rs` so participant rules can be
//! located and unit tested independently of waste/transfer rules. Returns
//! [`ValidationError`] rather than panicking, so callers can decide how to
//! surface a rejected registration.

use soroban_sdk::{Address, Env};

use super::{MAX_LAT, MAX_LON, MAX_NAME_LEN, ValidationError};

/// Validates a participant registration: address must not be the contract
/// itself, and coordinates must be valid WGS-84 microdegrees.
pub fn validate_registration(
    env: &Env,
    address: &Address,
    latitude: i128,
    longitude: i128,
) -> Result<(), ValidationError> {
    if address == &env.current_contract_address() {
        return Err(ValidationError::AddressNotAllowed {
            context: "participant registration",
        });
    }
    validate_coordinates(latitude, longitude)
}

/// Validates that a participant's display name is non-empty and within the
/// maximum allowed length.
pub fn validate_name(name: &soroban_sdk::String) -> Result<(), ValidationError> {
    if name.len() == 0 {
        return Err(ValidationError::EmptyString { field: "participant name" });
    }
    if name.len() > MAX_NAME_LEN {
        return Err(ValidationError::StringTooLong {
            field: "participant name",
            max_len: MAX_NAME_LEN,
        });
    }
    Ok(())
}

/// Validates that two participant addresses (e.g. a self-referral) differ.
pub fn validate_distinct_participants(a: &Address, b: &Address) -> Result<(), ValidationError> {
    if a == b {
        return Err(ValidationError::AddressesNotDistinct {
            context: "participant registration",
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
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn registration_accepts_valid_address_and_coordinates() {
        let env = Env::default();
        let addr = Address::generate(&env);
        assert!(validate_registration(&env, &addr, 0, 0).is_ok());
    }

    #[test]
    fn registration_rejects_contract_address() {
        let env = Env::default();
        let contract = env.current_contract_address();
        assert_eq!(
            validate_registration(&env, &contract, 0, 0),
            Err(ValidationError::AddressNotAllowed {
                context: "participant registration"
            })
        );
    }

    #[test]
    fn registration_rejects_out_of_range_latitude() {
        let env = Env::default();
        let addr = Address::generate(&env);
        assert!(matches!(
            validate_registration(&env, &addr, 91_000_000, 0),
            Err(ValidationError::OutOfRange { field: "latitude", .. })
        ));
    }

    #[test]
    fn registration_rejects_out_of_range_longitude() {
        let env = Env::default();
        let addr = Address::generate(&env);
        assert!(matches!(
            validate_registration(&env, &addr, 0, 181_000_000),
            Err(ValidationError::OutOfRange { field: "longitude", .. })
        ));
    }

    #[test]
    fn name_accepts_non_empty_within_limit() {
        let env = Env::default();
        let name = soroban_sdk::String::from_str(&env, "Recycler One");
        assert!(validate_name(&name).is_ok());
    }

    #[test]
    fn name_rejects_empty_string() {
        let env = Env::default();
        let name = soroban_sdk::String::from_str(&env, "");
        assert_eq!(
            validate_name(&name),
            Err(ValidationError::EmptyString { field: "participant name" })
        );
    }

    #[test]
    fn name_rejects_too_long_string() {
        let env = Env::default();
        let long = "a".repeat(MAX_NAME_LEN as usize + 1);
        let name = soroban_sdk::String::from_str(&env, &long);
        assert!(matches!(
            validate_name(&name),
            Err(ValidationError::StringTooLong { field: "participant name", .. })
        ));
    }

    #[test]
    fn distinct_participants_accepts_different_addresses() {
        let env = Env::default();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        assert!(validate_distinct_participants(&a, &b).is_ok());
    }

    #[test]
    fn distinct_participants_rejects_same_address() {
        let env = Env::default();
        let a = Address::generate(&env);
        assert_eq!(
            validate_distinct_participants(&a, &a),
            Err(ValidationError::AddressesNotDistinct {
                context: "participant registration"
            })
        );
    }
}
