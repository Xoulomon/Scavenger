//! Transfer- and reward-split-specific validation rules.
//!
//! Split out of the monolithic `validation.rs` so transfer/percentage rules
//! can be located and unit tested independently of participant/waste rules.

use soroban_sdk::Address;

use super::{MAX_NOTE_LEN, ValidationError};

/// Validates a waste transfer: `from` and `to` must differ.
pub fn validate_parties(from: &Address, to: &Address) -> Result<(), ValidationError> {
    if from == to {
        return Err(ValidationError::AddressesNotDistinct { context: "waste transfer" });
    }
    Ok(())
}

/// Validates that collector + owner reward percentages do not exceed 100.
pub fn validate_reward_split(collector_pct: u32, owner_pct: u32) -> Result<(), ValidationError> {
    if collector_pct > 100 {
        return Err(ValidationError::PercentageTooHigh { field: "collector_percentage" });
    }
    if owner_pct > 100 {
        return Err(ValidationError::PercentageTooHigh { field: "owner_percentage" });
    }
    if collector_pct + owner_pct > 100 {
        return Err(ValidationError::PercentageTooHigh { field: "collector_percentage + owner_percentage" });
    }
    Ok(())
}

/// Validates an optional transfer note/memo length.
pub fn validate_note(note: &soroban_sdk::String) -> Result<(), ValidationError> {
    if note.len() > MAX_NOTE_LEN {
        return Err(ValidationError::StringTooLong { field: "transfer note", max_len: MAX_NOTE_LEN });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn parties_accepts_different_addresses() {
        let env = Env::default();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        assert!(validate_parties(&a, &b).is_ok());
    }

    #[test]
    fn parties_rejects_self_transfer() {
        let env = Env::default();
        let a = Address::generate(&env);
        assert_eq!(
            validate_parties(&a, &a),
            Err(ValidationError::AddressesNotDistinct { context: "waste transfer" })
        );
    }

    #[test]
    fn reward_split_accepts_valid_split() {
        assert!(validate_reward_split(40, 60).is_ok());
        assert!(validate_reward_split(0, 0).is_ok());
    }

    #[test]
    fn reward_split_rejects_collector_over_100() {
        assert_eq!(
            validate_reward_split(101, 0),
            Err(ValidationError::PercentageTooHigh { field: "collector_percentage" })
        );
    }

    #[test]
    fn reward_split_rejects_owner_over_100() {
        assert_eq!(
            validate_reward_split(0, 101),
            Err(ValidationError::PercentageTooHigh { field: "owner_percentage" })
        );
    }

    #[test]
    fn reward_split_rejects_sum_over_100_even_when_each_individually_valid() {
        assert!(matches!(
            validate_reward_split(60, 60),
            Err(ValidationError::PercentageTooHigh { .. })
        ));
    }

    #[test]
    fn note_accepts_within_limit() {
        let env = Env::default();
        let note = soroban_sdk::String::from_str(&env, "thanks!");
        assert!(validate_note(&note).is_ok());
    }

    #[test]
    fn note_rejects_too_long() {
        let env = Env::default();
        let long = "n".repeat(MAX_NOTE_LEN as usize + 1);
        let note = soroban_sdk::String::from_str(&env, &long);
        assert!(matches!(
            validate_note(&note),
            Err(ValidationError::StringTooLong { field: "transfer note", .. })
        ));
    }
}
