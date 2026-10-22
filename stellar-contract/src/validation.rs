//! Validation logic for the stellar-contract crate.
//!
//! This module contains security-sensitive validation helpers. Because these
//! functions guard against malformed or malicious input, their tests are
//! exercised by the mutation-testing pilot (see `MUTATION_TESTING.md`).
//!
//! Mutation testing baseline (cargo-mutants, pilot scope = this file):
//!   cargo mutants --file stellar-contract/src/validation.rs
//! The tests below are written to kill the mutants that previously survived
//! (boundary comparisons, off-by-one checks, and inverted boolean guards).

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

/// Validates a user-supplied identifier.
///
/// An identifier must be non-empty, within the configured length bounds, and
/// contain only ASCII alphanumeric characters or underscores.
pub fn validate_identifier(input: &str) -> Result<(), ValidationError> {
    if input.is_empty() {
        return Err(ValidationError::Empty);
    }

    let len = input.chars().count();
    if len < MIN_IDENTIFIER_LEN {
        return Err(ValidationError::TooShort);
    }
    if len > MAX_IDENTIFIER_LEN {
        return Err(ValidationError::TooLong);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_identifier() {
        assert_eq!(validate_identifier("abc"), Ok(()));
        assert_eq!(validate_identifier("user_123"), Ok(()));
    }

    #[test]
    fn rejects_empty_identifier() {
        assert_eq!(validate_identifier(""), Err(ValidationError::Empty));
    }

    #[test]
    fn rejects_identifier_below_min_length() {
        // Kills mutants that relax the `< MIN_IDENTIFIER_LEN` boundary.
        assert_eq!(validate_identifier("ab"), Err(ValidationError::TooShort));
    }

    #[test]
    fn accepts_identifier_at_min_length() {
        // Boundary: exactly MIN_IDENTIFIER_LEN must be accepted.
        assert_eq!(validate_identifier("abc"), Ok(()));
    }

    #[test]
    fn accepts_identifier_at_max_length() {
        // Boundary: exactly MAX_IDENTIFIER_LEN must be accepted.
        let input = "a".repeat(MAX_IDENTIFIER_LEN);
        assert_eq!(validate_identifier(&input), Ok(()));
    }

    #[test]
    fn rejects_identifier_above_max_length() {
        // Kills mutants that relax the `> MAX_IDENTIFIER_LEN` boundary.
        let input = "a".repeat(MAX_IDENTIFIER_LEN + 1);
        assert_eq!(validate_identifier(&input), Err(ValidationError::TooLong));
    }

    #[test]
    fn rejects_identifier_with_invalid_character() {
        assert_eq!(
            validate_identifier("abc-def"),
            Err(ValidationError::InvalidCharacter('-'))
        );
        assert_eq!(
            validate_identifier("abc def"),
            Err(ValidationError::InvalidCharacter(' '))
        );
    }

    #[test]
    fn accepts_underscore_in_identifier() {
        // Kills mutants that drop the `ch == '_'` allowance.
        assert_eq!(validate_identifier("a_b"), Ok(()));
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
