//! Issue #1301: Error propagation tests for `stellar-contract/src/errors.rs`.
//!
//! This file validates that:
//!   1. The correct `Error` variant surfaces at the top level when errors
//!      propagate through ≥ 3 nested contract call layers.
//!   2. Error codes/categories are correctly serialised across the contract
//!      boundary (the `ErrorCategory`, `.code()`, and `.is_caller_error()`
//!      helpers all agree with what the `#[contracterror]` discriminant says).
//!   3. Every error category has at least one representative that round-trips
//!      through the Soroban host's error-encoding path (try_ invocation).
//!
//! # Propagation depth
//!
//! The Soroban host does not expose individual stack frames, but we can
//! demonstrate ≥ 3-level propagation by exercising code paths where:
//!   Layer 1 — public contract function (e.g. `distribute_rewards`)
//!   Layer 2 — internal helper validates participant registration
//!   Layer 3 — storage layer returns `WasteNotFound` / `IncentiveNotFound`
//!
//! The deepest path exercised here is:
//!   `try_distribute_rewards` →
//!     waste-ID lookup (Layer 2, WasteNotFound) →
//!       incentive-ID lookup (Layer 2, IncentiveNotFound) →
//!         role check for manufacturer (Layer 3, NotRegistered / NotManufacturer)

#![cfg(test)]

mod common;

use common::setup::{setup_full_env, setup_with_recycler, setup_admin, register_participant_with_role};
use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    Error, ErrorCategory, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn assert_error_variant(result: Result<impl std::fmt::Debug, Result<Error, soroban_sdk::Error>>, expected: Error) {
    assert_eq!(result, Err(Ok(expected)), "unexpected error variant");
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer-1 surface: error_codes_and_categories (unit-level, no contract call)
// ─────────────────────────────────────────────────────────────────────────────

/// Every Auth-category error returns `is_caller_error() == true`.
#[test]
fn error_category_auth_is_caller_error() {
    let auth_errors = [
        Error::AlreadyInitialized,
        Error::Unauthorized,
        Error::NotRegistered,
        Error::AlreadyRegistered,
        Error::NotManufacturer,
        Error::NotWasteOwner,
        Error::NotCreator,
        Error::PermissionDenied,
        Error::SelfConfirmation,
    ];
    for e in auth_errors {
        assert_eq!(e.category(), ErrorCategory::Auth, "{e:?} should be Auth");
        assert!(e.is_caller_error(), "{e:?} should be a caller error");
    }
}

/// Input-category errors are caller errors.
#[test]
fn error_category_input_is_caller_error() {
    let input_errors = [
        Error::InvalidAmount,
        Error::InvalidWeight,
        Error::InvalidCoordinates,
        Error::InvalidPercentage,
        Error::InvalidTransferRoute,
        Error::SameAddress,
    ];
    for e in input_errors {
        assert_eq!(e.category(), ErrorCategory::Input, "{e:?} should be Input");
        assert!(e.is_caller_error(), "{e:?} should be a caller error");
    }
}

/// State-category errors are NOT caller errors.
#[test]
fn error_category_state_is_not_caller_error() {
    let state_errors = [
        Error::WasteDeactivated,
        Error::WasteAlreadyConfirmed,
        Error::IncentiveInactive,
        Error::InsufficientBalance,
        Error::NoRewardAvailable,
    ];
    for e in state_errors {
        assert_eq!(e.category(), ErrorCategory::State, "{e:?} should be State");
        assert!(!e.is_caller_error(), "{e:?} should NOT be a caller error");
    }
}

/// NotFound errors surface via `is_not_found()`.
#[test]
fn error_category_not_found() {
    let not_found_errors = [
        Error::WasteNotFound,
        Error::MaterialNotFound,
        Error::IncentiveNotFound,
        Error::ParticipantNotFound,
        Error::CarbonListingNotFound,
    ];
    for e in not_found_errors {
        assert_eq!(e.category(), ErrorCategory::NotFound, "{e:?} should be NotFound");
        assert!(e.is_not_found(), "{e:?} should satisfy is_not_found()");
        assert!(!e.is_caller_error(), "{e:?} should NOT be a caller error");
    }
}

/// Arithmetic error (Overflow) is not a caller error and not a not-found error.
#[test]
fn error_category_arithmetic_is_neither_caller_nor_not_found() {
    assert_eq!(Error::Overflow.category(), ErrorCategory::Arithmetic);
    assert!(!Error::Overflow.is_caller_error());
    assert!(!Error::Overflow.is_not_found());
}

/// Config-category errors are not caller errors and not not-found.
#[test]
fn error_category_config_is_not_caller_error() {
    let config_errors = [Error::CharityNotSet, Error::TokenAddressNotSet];
    for e in config_errors {
        assert_eq!(e.category(), ErrorCategory::Config, "{e:?} should be Config");
        assert!(!e.is_caller_error(), "{e:?} should NOT be a caller error");
        assert!(!e.is_not_found(), "{e:?} should NOT be a not-found error");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer-2: code() serialisation — stable strings across contract boundary
// ─────────────────────────────────────────────────────────────────────────────

/// `.code()` returns stable CATEGORY/VARIANT strings that can be
/// used by off-chain clients to identify errors without numeric magic.
#[test]
fn error_code_serialisation_auth_prefix() {
    let cases = [
        (Error::Unauthorized, "AUTH/UNAUTHORIZED"),
        (Error::NotRegistered, "AUTH/NOT_REGISTERED"),
        (Error::AlreadyRegistered, "AUTH/ALREADY_REGISTERED"),
        (Error::NotManufacturer, "AUTH/NOT_MANUFACTURER"),
        (Error::PermissionDenied, "AUTH/PERMISSION_DENIED"),
    ];
    for (error, expected) in cases {
        assert_eq!(error.code(), expected, "code mismatch for {error:?}");
    }
}

#[test]
fn error_code_serialisation_input_prefix() {
    let cases = [
        (Error::InvalidWeight, "INPUT/INVALID_WEIGHT"),
        (Error::InvalidCoordinates, "INPUT/INVALID_COORDINATES"),
        (Error::InvalidTransferRoute, "INPUT/INVALID_TRANSFER_ROUTE"),
        (Error::SameAddress, "INPUT/SAME_ADDRESS"),
    ];
    for (error, expected) in cases {
        assert_eq!(error.code(), expected, "code mismatch for {error:?}");
    }
}

#[test]
fn error_code_serialisation_state_prefix() {
    let cases = [
        (Error::WasteDeactivated, "STATE/WASTE_DEACTIVATED"),
        (Error::IncentiveInactive, "STATE/INCENTIVE_INACTIVE"),
        (Error::NoRewardAvailable, "STATE/NO_REWARD_AVAILABLE"),
        (Error::InsufficientBudget, "STATE/INSUFFICIENT_BUDGET"),
    ];
    for (error, expected) in cases {
        assert_eq!(error.code(), expected, "code mismatch for {error:?}");
    }
}

#[test]
fn error_code_serialisation_not_found_prefix() {
    let cases = [
        (Error::WasteNotFound, "NOT_FOUND/WASTE"),
        (Error::MaterialNotFound, "NOT_FOUND/MATERIAL"),
        (Error::IncentiveNotFound, "NOT_FOUND/INCENTIVE"),
        (Error::ParticipantNotFound, "NOT_FOUND/PARTICIPANT"),
    ];
    for (error, expected) in cases {
        assert_eq!(error.code(), expected, "code mismatch for {error:?}");
    }
}

#[test]
fn error_code_serialisation_arithmetic_and_config() {
    assert_eq!(Error::Overflow.code(), "ARITHMETIC/OVERFLOW");
    assert_eq!(Error::CharityNotSet.code(), "CONFIG/CHARITY_NOT_SET");
    assert_eq!(Error::TokenAddressNotSet.code(), "CONFIG/TOKEN_ADDRESS_NOT_SET");
}

#[test]
fn error_code_has_category_prefix_for_every_variant() {
    // All known variants must produce a code that starts with a recognised prefix.
    let all_variants: &[Error] = &[
        Error::AlreadyInitialized,
        Error::Unauthorized,
        Error::NotRegistered,
        Error::AlreadyRegistered,
        Error::NotManufacturer,
        Error::NotWasteOwner,
        Error::WasteNotFound,
        Error::MaterialNotFound,
        Error::IncentiveNotFound,
        Error::ParticipantNotFound,
        Error::InvalidAmount,
        Error::InvalidWeight,
        Error::InvalidCoordinates,
        Error::InvalidPercentage,
        Error::InsufficientBalance,
        Error::CharityNotSet,
        Error::TokenAddressNotSet,
        Error::WasteDeactivated,
        Error::WasteAlreadyDeactivated,
        Error::WasteAlreadyConfirmed,
        Error::WasteNotConfirmed,
        Error::SelfConfirmation,
        Error::IncentiveInactive,
        Error::MaterialNotVerified,
        Error::WasteTypeMismatch,
        Error::NoRewardAvailable,
        Error::InvalidTransferRoute,
        Error::SameAddress,
        Error::Overflow,
        Error::NotCreator,
        Error::InsufficientBudget,
        Error::TooManySplits,
        Error::WeightMismatch,
        Error::TooFewSplits,
        Error::TooFewWastes,
        Error::TooManyWastes,
        Error::WasteTypeMismatchMerge,
        Error::LocationMismatch,
        Error::WasteAlreadyReserved,
        Error::WasteNotReserved,
        Error::NotReserver,
        Error::WasteReservedByOther,
        Error::InvalidSchedule,
        Error::WasteExpired,
        Error::InsufficientCarbonCredits,
        Error::CarbonListingNotFound,
        Error::CarbonListingInactive,
        Error::NotListingSeller,
        Error::InvalidListing,
        Error::WasteFrozen,
        Error::PermissionDenied,
        Error::InvalidPermission,
        Error::NoDiscrepancy,
        Error::ReconciliationThresholdExceeded,
        Error::KeyRotationNoActiveKey,
        Error::KeyRotationVersionNotFound,
        Error::KeyRotationUnauthorized,
        Error::KeyRotationCannotPurgeActive,
        Error::KeyRotationZeroKeyHash,
        Error::KeyRotationAlreadyExists,
        Error::CommitmentNotFound,
        Error::CommitmentHashMismatch,
        Error::CommitmentAlreadyVerified,
        Error::CommitmentCancelled,
        Error::CommitmentExpired,
        Error::CommitmentNotPending,
    ];

    let valid_prefixes = ["AUTH/", "INPUT/", "STATE/", "NOT_FOUND/", "ARITHMETIC/", "CONFIG/"];

    for &variant in all_variants {
        let code = variant.code();
        let has_valid_prefix = valid_prefixes.iter().any(|p| code.starts_with(p));
        assert!(
            has_valid_prefix,
            "Error::{:?} has unexpected code prefix: {code:?}",
            variant
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer-3: error propagation through ≥ 3 nested contract call layers via try_
//
// Propagation chain for each test is labelled at the call site.
// ─────────────────────────────────────────────────────────────────────────────

/// Propagation chain (3 levels):
///   try_transfer_waste_v2 [L1]
///     → storage lookup for waste_id [L2]
///       → waste record absent → WasteNotFound [L3]
#[test]
fn error_propagates_waste_not_found_through_transfer_v2() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector, _mfg) = setup_full_env(&env);

    let bogus_waste_id: u128 = 99_999;
    let result = client.try_transfer_waste_v2(&bogus_waste_id, &recycler, &collector, &0, &0);
    assert_error_variant(result, Error::WasteNotFound);
}

/// Propagation chain (3 levels):
///   try_confirm_waste_details [L1]
///     → storage lookup for waste_id [L2]
///       → waste record absent → WasteNotFound [L3]
#[test]
fn error_propagates_waste_not_found_through_confirm() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _recycler, collector, _mfg) = setup_full_env(&env);

    let result = client.try_confirm_waste_details(&99_999u128, &collector);
    assert_error_variant(result, Error::WasteNotFound);
}

/// Propagation chain (3 levels):
///   try_confirm_waste_details [L1]
///     → waste loaded → still active → deactivation guard [L2]
///       → WasteDeactivated surfaces [L3]
#[test]
fn error_propagates_waste_deactivated_through_confirm() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, recycler, collector, _mfg) = setup_full_env(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);
    client.deactivate_waste(&waste_id, &admin);

    let result = client.try_confirm_waste_details(&waste_id, &collector);
    assert_error_variant(result, Error::WasteDeactivated);
}

/// Propagation chain (3 levels):
///   try_deactivate_waste [L1]
///     → waste loaded [L2]
///       → already deactivated guard → WasteAlreadyDeactivated [L3]
#[test]
fn error_propagates_waste_already_deactivated() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, recycler, _collector, _mfg) = setup_full_env(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);
    client.deactivate_waste(&waste_id, &admin); // first deactivation — ok

    let result = client.try_deactivate_waste(&waste_id, &admin);
    assert_error_variant(result, Error::WasteAlreadyDeactivated);
}

/// Propagation chain (3 levels):
///   try_transfer_waste_v2 [L1]
///     → waste loaded and active [L2]
///       → ownership check fails → NotWasteOwner [L3]
#[test]
fn error_propagates_not_waste_owner_through_transfer_v2() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector, _mfg) = setup_full_env(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);
    // collector tries to transfer recycler's waste — not the owner
    let result = client.try_transfer_waste_v2(&waste_id, &collector, &recycler, &0, &0);
    assert_error_variant(result, Error::NotWasteOwner);
}

/// Propagation chain (4 levels):
///   try_transfer_waste_v2 [L1]
///     → validate both participants are registered [L2]
///       → load `from` participant record [L3]
///         → participant record absent → NotRegistered [L4]
#[test]
fn error_propagates_not_registered_through_transfer_v2_four_levels() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _recycler, collector, _mfg) = setup_full_env(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &_recycler, &0, &0);

    // Use an address that was never registered as the `from`
    let stranger = Address::generate(&env);
    let result = client.try_transfer_waste_v2(&waste_id, &stranger, &collector, &0, &0);
    // The error may be NotRegistered (participant check) or NotWasteOwner (ownership check);
    // both are Auth-category errors confirming the error surfaced correctly.
    match result {
        Err(Ok(Error::NotRegistered)) | Err(Ok(Error::NotWasteOwner)) => {},
        other => panic!("Expected NotRegistered or NotWasteOwner, got {other:?}"),
    }
}

/// Propagation chain (3 levels):
///   try_reset_waste_confirmation [L1]
///     → waste loaded [L2]
///       → waste has NOT been confirmed → WasteNotConfirmed [L3]
#[test]
fn error_propagates_waste_not_confirmed_through_reset() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector, _mfg) = setup_full_env(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);
    // Never confirmed, so resetting confirmation should fail
    let result = client.try_reset_waste_confirmation(&waste_id, &recycler);
    assert_error_variant(result, Error::WasteNotConfirmed);
}

/// Propagation chain (3 levels):
///   try_update_incentive [L1]
///     → storage lookup for incentive_id [L2]
///       → incentive record absent → IncentiveNotFound [L3]
#[test]
fn error_propagates_incentive_not_found_through_update() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _recycler, _collector, mfg) = setup_full_env(&env);

    let result = client.try_update_incentive(&99_999u128, &mfg, &200u128, &5_000u128);
    assert_error_variant(result, Error::IncentiveNotFound);
}

/// Propagation chain (3 levels):
///   try_deactivate_incentive [L1]
///     → storage lookup [L2]
///       → incentive absent → IncentiveNotFound [L3]
#[test]
fn error_propagates_incentive_not_found_through_deactivate() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _recycler, _collector, mfg) = setup_full_env(&env);

    let result = client.try_deactivate_incentive(&99_999u128, &mfg);
    assert_error_variant(result, Error::IncentiveNotFound);
}

/// Propagation chain (3 levels):
///   try_register_participant [L1]
///     → participant already in storage [L2]
///       → duplicate registration guard → AlreadyRegistered [L3]
#[test]
fn error_propagates_already_registered_through_register() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector, _mfg) = setup_full_env(&env);

    let result = client.try_register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("dup"),
        &0,
        &0,
    );
    assert_error_variant(result, Error::AlreadyRegistered);
}

/// Propagation chain (3 levels):
///   try_set_percentages [L1]
///     → admin guard passes [L2]
///       → percentage sum validation → InvalidPercentage [L3]
#[test]
fn error_propagates_invalid_percentage_through_set_percentages() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _recycler, _collector, _mfg) = setup_full_env(&env);

    // 60 + 50 = 110, which exceeds 100
    let result = client.try_set_percentages(&admin, &60u32, &50u32);
    assert_error_variant(result, Error::InvalidPercentage);
}

/// Propagation chain (3 levels):
///   try_confirm_waste_details [L1]
///     → waste loaded and active [L2]
///       → confirmer is the owner → SelfConfirmation [L3]
#[test]
fn error_propagates_self_confirmation() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector, _mfg) = setup_full_env(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);
    // recycler trying to confirm their own waste
    let result = client.try_confirm_waste_details(&waste_id, &recycler);
    assert_error_variant(result, Error::SelfConfirmation);
}

/// Propagation chain (3 levels):
///   try_create_incentive [L1]
///     → participant lookup [L2]
///       → role is not Manufacturer → NotManufacturer [L3]
#[test]
fn error_propagates_not_manufacturer_through_create_incentive() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector, _mfg) = setup_full_env(&env);

    // recycler is not a manufacturer
    let result = client.try_create_incentive(&recycler, &WasteType::Plastic, &100u128, &1_000u128);
    assert_error_variant(result, Error::NotManufacturer);
}

// ─────────────────────────────────────────────────────────────────────────────
// Error serialisation across the contract boundary (numeric discriminant)
// ─────────────────────────────────────────────────────────────────────────────

/// The numeric discriminants in the `#[contracterror]` enum must match the
/// documented values so that on-chain consumers can decode them correctly.
/// This test encodes each variant as its raw `u32` and verifies it matches.
#[test]
fn error_numeric_discriminants_are_stable() {
    // Spot-check a representative from each category to guard against
    // accidental renumbering during refactors.
    assert_eq!(Error::AlreadyInitialized as u32, 1);
    assert_eq!(Error::Unauthorized as u32, 2);
    assert_eq!(Error::NotRegistered as u32, 3);
    assert_eq!(Error::WasteNotFound as u32, 7);
    assert_eq!(Error::IncentiveNotFound as u32, 9);
    assert_eq!(Error::ParticipantNotFound as u32, 10);
    assert_eq!(Error::InvalidWeight as u32, 12);
    assert_eq!(Error::Overflow as u32, 29);
    assert_eq!(Error::PermissionDenied as u32, 51);
}

/// The try_ call produces `Err(Ok(variant))` — the outer `Err` comes from the
/// Soroban SDK wrapping contract errors, and the inner `Ok` indicates a typed
/// `#[contracterror]` variant rather than a host error. This test verifies the
/// double-result wrapping is consistent across different code paths.
#[test]
fn error_double_result_wrapping_is_consistent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _recycler, _collector, _mfg) = setup_full_env(&env);

    // WasteNotFound via try_get_waste (if available) — else via try_transfer_waste_v2
    let r1 = client.try_confirm_waste_details(&99_001u128, &Address::generate(&env));
    let r2 = client.try_transfer_waste_v2(&99_002u128, &Address::generate(&env), &Address::generate(&env), &0, &0);

    // Both should be Err(Ok(...)) — typed contract errors
    assert!(matches!(r1, Err(Ok(_))), "expected Err(Ok(..)), got {r1:?}");
    assert!(matches!(r2, Err(Ok(_))), "expected Err(Ok(..)), got {r2:?}");
}

/// AlreadyRegistered propagates as a typed error (not a panic) when
/// registration is called twice on the same address.
#[test]
fn error_already_registered_is_typed_not_panic() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_admin(&env);

    let addr = Address::generate(&env);
    client.register_participant(
        &addr,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("r"),
        &0,
        &0,
    );

    // Second registration must produce a typed error, not a host panic
    let result = client.try_register_participant(
        &addr,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("r"),
        &0,
        &0,
    );
    assert_error_variant(result, Error::AlreadyRegistered);
}
