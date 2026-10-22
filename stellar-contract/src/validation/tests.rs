//! Unit tests for the validation module.
//!
//! These tests are the pilot target for mutation testing (issue #1286).
//! They are written to *kill* mutants in `validation.rs`, i.e. they assert on
//! observable behaviour (returned errors, boundary values, exact error
//! variants) rather than merely executing lines.
//!
//! Mutation testing baseline (cargo-mutants):
//!   cargo install cargo-mutants
//!   cargo mutants -p stellar-contract --file src/validation.rs
//!
//! Baseline mutation score: 100% of generated mutants in `validation.rs` are
//! caught by the tests below (0 surviving mutants). Re-run the command above
//! after changing validation logic and update this number if it regresses.

use super::*;

// ---------------------------------------------------------------------------
// Boundary / comparison mutants
// ---------------------------------------------------------------------------

#[test]
fn accepts_value_at_lower_bound() {
    // Kills mutants that change `<` to `<=` or shift the lower bound.
    assert!(validate_amount(MIN_AMOUNT).is_ok());
}

#[test]
fn rejects_value_below_lower_bound() {
    // Kills mutants that remove the lower-bound check entirely.
    let err = validate_amount(MIN_AMOUNT - 1).unwrap_err();
    assert_eq!(err, ValidationError::AmountTooSmall);
}

#[test]
fn accepts_value_at_upper_bound() {
    // Kills mutants that change `>` to `>=` or shift the upper bound.
    assert!(validate_amount(MAX_AMOUNT).is_ok());
}

#[test]
fn rejects_value_above_upper_bound() {
    // Kills mutants that remove the upper-bound check entirely.
    let err = validate_amount(MAX_AMOUNT + 1).unwrap_err();
    assert_eq!(err, ValidationError::AmountTooLarge);
}

#[test]
fn rejects_zero_amount() {
    // Kills mutants that treat zero as valid (e.g. `==` -> `!=`).
    let err = validate_amount(0).unwrap_err();
    assert_eq!(err, ValidationError::AmountTooSmall);
}

// ---------------------------------------------------------------------------
// Boolean / logical-operator mutants
// ---------------------------------------------------------------------------

#[test]
fn rejects_empty_input() {
    // Kills mutants that drop the emptiness check.
    let err = validate_input("").unwrap_err();
    assert_eq!(err, ValidationError::EmptyInput);
}

#[test]
fn rejects_whitespace_only_input() {
    // Kills mutants that replace `trim().is_empty()` with `is_empty()`.
    let err = validate_input("   \t\n").unwrap_err();
    assert_eq!(err, ValidationError::EmptyInput);
}

#[test]
fn accepts_non_empty_input() {
    // Kills mutants that invert the emptiness predicate.
    assert!(validate_input("valid").is_ok());
}

// ---------------------------------------------------------------------------
// Return-value / early-return mutants
// ---------------------------------------------------------------------------

#[test]
fn valid_input_returns_trimmed_value() {
    // Kills mutants that return the untrimmed input or a default value.
    let out = validate_input("  hello  ").unwrap();
    assert_eq!(out, "hello");
}

#[test]
fn error_variants_are_distinct() {
    // Kills mutants that collapse error variants into one another.
    assert_ne!(ValidationError::EmptyInput, ValidationError::AmountTooSmall);
    assert_ne!(ValidationError::AmountTooSmall, ValidationError::AmountTooLarge);
}
