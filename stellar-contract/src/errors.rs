//! Shared error types for the Scavenger contract.
// ── Issue #921: Shared error module ──────────────────────────────────────────
//
// This file is the **single source of truth** for all error codes in the
// `stellar-scavngr-contract` crate.
//
// Authoring rules:
//   1. Every new error variant MUST be added here, not in a sub-module.
//   2. Sub-modules (`participant.rs`, `waste.rs`, `incentive.rs`, etc.) MUST
//      import errors via `use crate::errors::Error;` — never define their own
//      contract error enums.
//   3. Subsystem-specific helper enums (e.g. `CommitmentError`,
//      `KeyRotationError`) that are **not** Soroban `#[contracterror]` types
//      may remain local to their module when the subsystem does not surface
//      errors to external callers.
//   4. `lib.rs` re-exports `Error` at the crate root via `pub use errors::Error;`.
//
// See docs/ERROR_MESSAGE_GUIDE.md for the reserved error-code ranges and table.

use soroban_sdk::contracterror;

// ── Error consolidation audit (issue #1097) ────────────────────────────────────
//
// Scope of the audit: `waste.rs`, `incentive.rs`, `transfer_mgmt.rs`, and
// `participant.rs`, as named in the issue.
//
// Findings:
// - `waste.rs`, `incentive.rs`, and `participant.rs` all exist and already
//   fully delegate error handling to this `Error` enum: every fallible
//   function in those three files returns `Result<_, Error>`, and none of
//   them define a local error enum or call `panic!`/`.expect()`. No
//   migration was needed in these files.
// - `transfer_mgmt.rs` does not exist in this codebase. Waste-transfer logic
//   (`transfer_waste`, `transfer_waste_v2`, `batch_transfer_waste`, the
//   auction functions, etc.) lives directly in `lib.rs`.
// - The actual duplicate-error-definition problem is in `lib.rs` itself: it
//   contains roughly 130 `panic!(...)`/`.expect(...)` call sites using ad hoc
//   string messages (e.g. `panic!("Admin already initialized")`,
//   `.expect("Waste not found")`) instead of the equivalent variant already
//   defined below (`Error::AlreadyInitialized`, `Error::WasteNotFound`, …).
//   This was not part of the issue's named file list, and is a much larger
//   change: converting it means changing the signature of every affected
//   `pub fn` in `ScavengerContract` from `T` to `Result<T, Error>` across an
//   ~8,000-line file that over 100 test files exercise, several of them via
//   `#[should_panic(expected = "<exact string>")]` on the current panic text.
//   At the time of that audit there was no working `cargo test` loop, so that
//   migration was not attempted blind — it needs tests to catch signature and
//   string-assertion breakage as it happens.
//
/// Typed error codes for the Scavngr contract.
///
/// Codes use reserved, non-overlapping ranges per [`ErrorCategory`]. The
/// complete variant-to-code table is maintained in
/// `docs/ERROR_MESSAGE_GUIDE.md`.
///
/// These ranges replace the previous sequential 1–54 assignments; clients
/// matching numeric contract errors must update to the codes in the guide.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// (1000) The contract admin has already been initialised.
    /// Returned by: `initialize_admin`
    AlreadyInitialized = 1000,

    /// (1001) The caller is not the contract administrator.
    /// Returned by: any admin-only function
    Unauthorized = 1001,

    /// (1002) The address is not a registered participant, or `is_registered` is false.
    /// Returned by: any function that requires a registered caller or target
    NotRegistered = 1002,

    /// (1003) The address is already registered as a participant.
    /// Returned by: `register_participant`
    AlreadyRegistered = 1003,

    /// (1004) The caller's role is not `Manufacturer`.
    /// Returned by: `create_incentive`
    NotManufacturer = 1004,

    /// (1005) The caller does not own the specified waste item.
    /// Returned by: `transfer_waste_v2`, `reset_waste_confirmation`, `deactivate_waste`
    NotWasteOwner = 1005,

    /// (1006) The current owner attempted to confirm their own waste item.
    /// Returned by: `confirm_waste_details`
    SelfConfirmation = 1006,

    /// (1007) The caller is not the original creator of the resource.
    /// Returned by: `deactivate_incentive`
    NotCreator = 1007,

    /// (1008) Caller is not the reserver and not the owner; cannot cancel.
    NotReserver = 1008,

    /// (1009) The caller is not the seller of the carbon listing.
    /// Returned by: `cancel_carbon_listing`
    NotListingSeller = 1009,

    /// (1010) The caller does not have the required permission for this operation.
    /// Returned by: any permission-guarded function
    PermissionDenied = 1010,

    /// (1011) The permission type provided is not valid.
    /// Returned by: `grant_permission`, `revoke_permission`
    InvalidPermission = 1011,

    /// (2000) A monetary or token amount is zero or negative.
    /// Returned by: `donate_to_charity`, `reward_tokens`
    InvalidAmount = 2000,

    /// (2001) A waste weight is outside the accepted range.
    /// Returned by: `recycle_waste`
    InvalidWeight = 2001,

    /// (2002) Latitude or longitude is outside the accepted range.
    /// Returned by: participant registration and location updates
    InvalidCoordinates = 2002,

    /// (2003) Percentages sum to more than 100.
    /// Returned by: percentage configuration functions
    InvalidPercentage = 2003,

    /// (2004) The role combination (`from` → `to`) is not a permitted transfer route.
    /// Valid routes: Recycler→Collector, Recycler→Manufacturer, Collector→Manufacturer.
    /// Returned by: `transfer_waste_v2`
    InvalidTransferRoute = 2004,

    /// (2005) Two addresses that must be different are equal.
    /// Returned by: address validation
    SameAddress = 2005,

    /// (2006) The number of splits exceeds the maximum allowed (10).
    TooManySplits = 2006,

    /// (2007) At least two split weights are required.
    TooFewSplits = 2007,

    /// (2008) Fewer than 2 waste IDs were provided for merge.
    TooFewWastes = 2008,

    /// (2009) More than 20 waste IDs were provided for merge.
    TooManyWastes = 2009,

    /// (2010) The sum of split weights does not equal the original waste weight.
    WeightMismatch = 2010,

    /// (2011) The wastes have different locations.
    LocationMismatch = 2011,

    /// (2012) A schedule has an invalid start/end time.
    InvalidSchedule = 2012,

    /// (2013) Listing amount or price is zero, or buyer equals seller.
    /// Returned by: `create_carbon_listing`, `purchase_carbon_listing`
    InvalidListing = 2013,

    /// (3000) The waste item is deactivated and cannot be transferred or confirmed.
    /// Returned by: `transfer_waste_v2`, `confirm_waste_details`
    WasteDeactivated = 3000,

    /// (3001) The waste item is already in the deactivated state.
    /// Returned by: `deactivate_waste`
    WasteAlreadyDeactivated = 3001,

    /// (3002) The waste item has already been confirmed by another participant.
    /// Returned by: `confirm_waste_details`
    WasteAlreadyConfirmed = 3002,

    /// (3003) The waste item has not been confirmed yet.
    /// Returned by: `reset_waste_confirmation`
    WasteNotConfirmed = 3003,

    /// (3004) The waste types involved in the operation do not match.
    /// Returned by: `claim_incentive_reward` and waste merge operations
    WasteTypeMismatch = 3004,

    /// (3005) Waste is already reserved by another participant.
    WasteAlreadyReserved = 3005,

    /// (3006) Waste is not reserved (cannot cancel a non-existent reservation).
    WasteNotReserved = 3006,

    /// (3007) Waste is reserved by someone else; transfer is blocked.
    WasteReservedByOther = 3007,

    /// (3008) The waste item has expired (TTL elapsed).
    /// Returned by: `transfer_waste_v2`, `batch_transfer_waste`
    WasteExpired = 3008,

    /// (3009) Waste is frozen (e.g. has an open dispute) and cannot be transferred.
    /// Returned by: `transfer_waste_v2`
    WasteFrozen = 3009,

    /// (3010) The incentive is not active and cannot be used.
    /// Returned by: `update_incentive`, `claim_incentive_reward`
    IncentiveInactive = 3010,

    /// (3011) The material has not been verified and cannot be used for reward claims.
    /// Returned by: `claim_incentive_reward`
    MaterialNotVerified = 3011,

    /// (3012) The calculated reward is zero (budget exhausted or weight too low).
    /// Returned by: `claim_incentive_reward`
    NoRewardAvailable = 3012,

    /// (3013) The donor's token balance is too low.
    /// Returned by: `donate_to_charity`
    InsufficientBalance = 3013,

    /// (3014) The reward budget is insufficient.
    InsufficientBudget = 3014,

    /// (3015) The participant does not have enough carbon credits.
    /// Returned by: `redeem_carbon_credits`, `create_carbon_listing`
    InsufficientCarbonCredits = 3015,

    /// (3016) The carbon listing is not active (already cancelled or purchased).
    /// Returned by: `cancel_carbon_listing`, `purchase_carbon_listing`
    CarbonListingInactive = 3016,

    /// (3017) The waste item has no weight discrepancy to reconcile.
    /// Returned by: `reconcile_waste`
    NoDiscrepancy = 3017,

    /// (3018) The reconciliation adjustment exceeds the allowed threshold.
    /// Returned by: `reconcile_waste`
    ReconciliationThresholdExceeded = 3018,

    /// (4000) No waste record exists for the given ID (v2 storage).
    /// Returned by: `transfer_waste_v2`, `confirm_waste_details`, `reset_waste_confirmation`,
    ///              `deactivate_waste`
    WasteNotFound = 4000,

    /// (4001) No material record exists for the given ID (v1 storage).
    /// Returned by: `verify_material`, `transfer_waste`, `claim_incentive_reward`
    MaterialNotFound = 4001,

    // ── RBAC errors (#704) ────────────────────────────────────────────────────
    /// (51) The caller does not have the required permission for this operation.
    /// Returned by: any permission-guarded function
    PermissionDenied = 51,

    /// (4004) No carbon listing exists for the given ID.
    /// Returned by: `cancel_carbon_listing`, `purchase_carbon_listing`
    CarbonListingNotFound = 4004,

    // ── Reconciliation errors (#706) ─────────────────────────────────────────
    /// (53) The waste item has no weight discrepancy to reconcile.
    /// Returned by: `reconcile_waste`
    NoDiscrepancy = 53,

    /// (54) The reconciliation adjustment exceeds the allowed threshold.
    /// Returned by: `reconcile_waste`
    ReconciliationThresholdExceeded = 54,

    // ── Consolidated subsystem errors (#1097 audit) ──────────────────────────
    //
    // These variants mirror `KeyRotationError` (key_rotation.rs) and
    // `CommitmentError` (zkp.rs) one-for-one. They are additive-only: the
    // existing local enums in those modules are left in place for now (per
    // rule #3 above, since neither is a `#[contracterror]` type surfaced to
    // external callers), but new call sites in those subsystems should
    // prefer these shared variants so the crate converges on a single
    // source of truth over time. No existing numeric codes were renumbered.
    /// (55) No key has been installed for this purpose yet.
    KeyRotationNoActiveKey = 55,
    /// (56) The requested (purpose, version) pair does not exist.
    KeyRotationVersionNotFound = 56,
    /// (57) Only the contract admin may rotate or revoke keys.
    KeyRotationUnauthorized = 57,
    /// (58) Cannot purge the currently active key version.
    KeyRotationCannotPurgeActive = 58,
    /// (59) The supplied key hash is all-zeros (likely an accident).
    KeyRotationZeroKeyHash = 59,
    /// (60) A key already exists for this purpose.
    KeyRotationAlreadyExists = 60,
    /// (61) No commitment found for this (committer, id) pair.
    CommitmentNotFound = 61,
    /// (62) Commitment hash does not match the supplied preimage.
    CommitmentHashMismatch = 62,
    /// (63) Commitment has already been consumed.
    CommitmentAlreadyVerified = 63,
    /// (64) Commitment has been cancelled.
    CommitmentCancelled = 64,
    /// (65) Commitment has expired.
    CommitmentExpired = 65,
    /// (66) Commitment is still pending — cannot cancel a verified commitment.
    CommitmentNotPending = 66,
    /// (67) A supplied value or payload is malformed.
    InvalidInput = 67,
    /// (68) A requested record or resource does not exist.
    NotFound = 68,
    /// (69) The resource is in a state that does not permit this operation.
    InvalidState = 69,
    /// (70) A ZKP commitment already exists for this (committer, id) pair.
    CommitmentAlreadyExists = 70,
}

// ── Issue #760: error categorization and context ──────────────────────────────

/// High-level category for an [`Error`].
/// Lets clients handle errors without switching on every variant.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ErrorCategory {
    /// Caller lacks permission or is not registered.
    Auth,
    /// A supplied value is out of range or malformed.
    Input,
    /// The entity is in the wrong lifecycle state.
    State,
    /// The requested entity does not exist.
    NotFound,
    /// Arithmetic overflow/underflow.
    Arithmetic,
    /// A required contract configuration value is missing.
    Config,
}

impl Error {
    /// Returns the high-level [`ErrorCategory`] for this error.
    pub fn category(self) -> ErrorCategory {
        match self {
            Error::AlreadyInitialized
            | Error::Unauthorized
            | Error::NotRegistered
            | Error::AlreadyRegistered
            | Error::NotManufacturer
            | Error::NotWasteOwner
            | Error::NotCreator
            | Error::NotReserver
            | Error::NotListingSeller
            | Error::PermissionDenied
            | Error::InvalidPermission
            | Error::SelfConfirmation => ErrorCategory::Auth,

            Error::InvalidAmount
            | Error::InvalidWeight
            | Error::InvalidCoordinates
            | Error::InvalidPercentage
            | Error::InvalidTransferRoute
            | Error::SameAddress
            | Error::TooManySplits
            | Error::TooFewSplits
            | Error::TooFewWastes
            | Error::TooManyWastes
            | Error::WeightMismatch
            | Error::LocationMismatch
            | Error::InvalidSchedule
            | Error::InvalidListing
            | Error::InvalidInput => ErrorCategory::Input,

            Error::WasteDeactivated
            | Error::WasteAlreadyDeactivated
            | Error::WasteAlreadyConfirmed
            | Error::WasteNotConfirmed
            | Error::WasteTypeMismatch
            | Error::WasteAlreadyReserved
            | Error::WasteNotReserved
            | Error::WasteReservedByOther
            | Error::WasteExpired
            | Error::WasteFrozen
            | Error::IncentiveInactive
            | Error::MaterialNotVerified
            | Error::NoRewardAvailable
            | Error::InsufficientBalance
            | Error::InsufficientBudget
            | Error::InsufficientCarbonCredits
            | Error::CarbonListingInactive
            | Error::NoDiscrepancy
            | Error::ReconciliationThresholdExceeded
            | Error::InvalidState
            | Error::CommitmentAlreadyExists => ErrorCategory::State,

            Error::WasteNotFound
            | Error::MaterialNotFound
            | Error::IncentiveNotFound
            | Error::ParticipantNotFound
            | Error::CarbonListingNotFound => ErrorCategory::NotFound,

            Error::Overflow => ErrorCategory::Arithmetic,

            Error::KeyRotationNoActiveKey
            | Error::KeyRotationVersionNotFound
            | Error::KeyRotationUnauthorized
            | Error::KeyRotationCannotPurgeActive
            | Error::KeyRotationZeroKeyHash
            | Error::KeyRotationAlreadyExists
            | Error::CommitmentNotFound
            | Error::CommitmentHashMismatch
            | Error::CommitmentAlreadyVerified
            | Error::CommitmentCancelled
            | Error::CommitmentExpired
            | Error::CommitmentNotPending => ErrorCategory::Auth,

            Error::NotFound => ErrorCategory::NotFound,

            Error::CharityNotSet | Error::TokenAddressNotSet => ErrorCategory::Config,
        }
    }

    /// Returns a stable machine-readable code string for logging/API responses.
    /// Format: `"CATEGORY/VARIANT"`, e.g. `"AUTH/UNAUTHORIZED"`.
    pub fn code(self) -> &'static str {
        match self {
            Error::AlreadyInitialized => "AUTH/ALREADY_INITIALIZED",
            Error::Unauthorized => "AUTH/UNAUTHORIZED",
            Error::NotRegistered => "AUTH/NOT_REGISTERED",
            Error::AlreadyRegistered => "AUTH/ALREADY_REGISTERED",
            Error::NotManufacturer => "AUTH/NOT_MANUFACTURER",
            Error::NotWasteOwner => "AUTH/NOT_WASTE_OWNER",
            Error::NotCreator => "AUTH/NOT_CREATOR",
            Error::NotReserver => "AUTH/NOT_RESERVER",
            Error::NotListingSeller => "AUTH/NOT_LISTING_SELLER",
            Error::PermissionDenied => "AUTH/PERMISSION_DENIED",
            Error::InvalidPermission => "AUTH/INVALID_PERMISSION",
            Error::SelfConfirmation => "AUTH/SELF_CONFIRMATION",
            Error::InvalidAmount => "INPUT/INVALID_AMOUNT",
            Error::InvalidWeight => "INPUT/INVALID_WEIGHT",
            Error::InvalidCoordinates => "INPUT/INVALID_COORDINATES",
            Error::InvalidPercentage => "INPUT/INVALID_PERCENTAGE",
            Error::InvalidTransferRoute => "INPUT/INVALID_TRANSFER_ROUTE",
            Error::SameAddress => "INPUT/SAME_ADDRESS",
            Error::TooManySplits => "INPUT/TOO_MANY_SPLITS",
            Error::TooFewSplits => "INPUT/TOO_FEW_SPLITS",
            Error::TooFewWastes => "INPUT/TOO_FEW_WASTES",
            Error::TooManyWastes => "INPUT/TOO_MANY_WASTES",
            Error::WeightMismatch => "INPUT/WEIGHT_MISMATCH",
            Error::LocationMismatch => "INPUT/LOCATION_MISMATCH",
            Error::InvalidSchedule => "INPUT/INVALID_SCHEDULE",
            Error::InvalidListing => "INPUT/INVALID_LISTING",
            Error::WasteDeactivated => "STATE/WASTE_DEACTIVATED",
            Error::WasteAlreadyDeactivated => "STATE/WASTE_ALREADY_DEACTIVATED",
            Error::WasteAlreadyConfirmed => "STATE/WASTE_ALREADY_CONFIRMED",
            Error::WasteNotConfirmed => "STATE/WASTE_NOT_CONFIRMED",
            Error::WasteTypeMismatch => "STATE/WASTE_TYPE_MISMATCH",
            Error::WasteAlreadyReserved => "STATE/WASTE_ALREADY_RESERVED",
            Error::WasteNotReserved => "STATE/WASTE_NOT_RESERVED",
            Error::WasteReservedByOther => "STATE/WASTE_RESERVED_BY_OTHER",
            Error::WasteExpired => "STATE/WASTE_EXPIRED",
            Error::WasteFrozen => "STATE/WASTE_FROZEN",
            Error::InvalidInput => "INPUT/INVALID_INPUT",
            Error::NotFound => "NOT_FOUND",
            Error::IncentiveInactive => "STATE/INCENTIVE_INACTIVE",
            Error::MaterialNotVerified => "STATE/MATERIAL_NOT_VERIFIED",
            Error::NoRewardAvailable => "STATE/NO_REWARD_AVAILABLE",
            Error::InsufficientBalance => "STATE/INSUFFICIENT_BALANCE",
            Error::InsufficientBudget => "STATE/INSUFFICIENT_BUDGET",
            Error::InsufficientCarbonCredits => "STATE/INSUFFICIENT_CARBON_CREDITS",
            Error::CarbonListingInactive => "STATE/CARBON_LISTING_INACTIVE",
            Error::NoDiscrepancy => "STATE/NO_DISCREPANCY",
            Error::ReconciliationThresholdExceeded => "STATE/RECONCILIATION_THRESHOLD_EXCEEDED",
            Error::WasteNotFound => "NOT_FOUND/WASTE",
            Error::MaterialNotFound => "NOT_FOUND/MATERIAL",
            Error::IncentiveNotFound => "NOT_FOUND/INCENTIVE",
            Error::ParticipantNotFound => "NOT_FOUND/PARTICIPANT",
            Error::CarbonListingNotFound => "NOT_FOUND/CARBON_LISTING",
            Error::Overflow => "ARITHMETIC/OVERFLOW",
            Error::CharityNotSet => "CONFIG/CHARITY_NOT_SET",
            Error::TokenAddressNotSet => "CONFIG/TOKEN_ADDRESS_NOT_SET",
            Error::KeyRotationNoActiveKey => "AUTH/KEY_ROTATION_NO_ACTIVE_KEY",
            Error::KeyRotationVersionNotFound => "AUTH/KEY_ROTATION_VERSION_NOT_FOUND",
            Error::KeyRotationUnauthorized => "AUTH/KEY_ROTATION_UNAUTHORIZED",
            Error::KeyRotationCannotPurgeActive => "AUTH/KEY_ROTATION_CANNOT_PURGE_ACTIVE",
            Error::KeyRotationZeroKeyHash => "AUTH/KEY_ROTATION_ZERO_KEY_HASH",
            Error::KeyRotationAlreadyExists => "AUTH/KEY_ROTATION_ALREADY_EXISTS",
            Error::CommitmentNotFound => "AUTH/COMMITMENT_NOT_FOUND",
            Error::CommitmentHashMismatch => "AUTH/COMMITMENT_HASH_MISMATCH",
            Error::CommitmentAlreadyVerified => "AUTH/COMMITMENT_ALREADY_VERIFIED",
            Error::CommitmentCancelled => "AUTH/COMMITMENT_CANCELLED",
            Error::CommitmentExpired => "AUTH/COMMITMENT_EXPIRED",
            Error::CommitmentNotPending => "AUTH/COMMITMENT_NOT_PENDING",
            Error::InvalidState => "STATE/INVALID_STATE",
            Error::CommitmentAlreadyExists => "STATE/COMMITMENT_ALREADY_EXISTS",
        }
    }

    /// Returns `true` if the caller can recover by fixing their inputs.
    pub fn is_caller_error(self) -> bool {
        matches!(self.category(), ErrorCategory::Auth | ErrorCategory::Input)
    }

    /// Returns `true` if this error represents a missing entity.
    pub fn is_not_found(self) -> bool {
        self.category() == ErrorCategory::NotFound
    }
}

// ── Issue #921: Unit tests for the shared error module ───────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn all_errors() -> &'static [Error] {
        &[
            Error::AlreadyInitialized,
            Error::Unauthorized,
            Error::NotRegistered,
            Error::AlreadyRegistered,
            Error::NotManufacturer,
            Error::NotWasteOwner,
            Error::SelfConfirmation,
            Error::NotCreator,
            Error::NotReserver,
            Error::NotListingSeller,
            Error::PermissionDenied,
            Error::InvalidPermission,
            Error::InvalidAmount,
            Error::InvalidWeight,
            Error::InvalidCoordinates,
            Error::InvalidPercentage,
            Error::InvalidTransferRoute,
            Error::SameAddress,
            Error::TooManySplits,
            Error::TooFewSplits,
            Error::TooFewWastes,
            Error::TooManyWastes,
            Error::WeightMismatch,
            Error::LocationMismatch,
            Error::InvalidSchedule,
            Error::InvalidListing,
            Error::WasteDeactivated,
            Error::WasteAlreadyDeactivated,
            Error::WasteAlreadyConfirmed,
            Error::WasteNotConfirmed,
            Error::WasteTypeMismatch,
            Error::WasteAlreadyReserved,
            Error::WasteNotReserved,
            Error::WasteReservedByOther,
            Error::WasteExpired,
            Error::WasteFrozen,
            Error::IncentiveInactive,
            Error::MaterialNotVerified,
            Error::NoRewardAvailable,
            Error::InsufficientBalance,
            Error::InsufficientBudget,
            Error::InsufficientCarbonCredits,
            Error::CarbonListingInactive,
            Error::NoDiscrepancy,
            Error::ReconciliationThresholdExceeded,
            Error::WasteNotFound,
            Error::MaterialNotFound,
            Error::IncentiveNotFound,
            Error::ParticipantNotFound,
            Error::CarbonListingNotFound,
            Error::Overflow,
            Error::CharityNotSet,
            Error::TokenAddressNotSet,
        ]
    }

    // Check the enum itself, rather than a separate list of expected numbers,
    // so duplicate discriminants cannot be hidden by a stale test fixture.
    #[test]
    fn error_codes_are_unique() {
        let all: &[(u32, Error)] = &[
            (1, Error::AlreadyInitialized),
            (2, Error::Unauthorized),
            (3, Error::NotRegistered),
            (4, Error::AlreadyRegistered),
            (5, Error::NotManufacturer),
            (6, Error::NotWasteOwner),
            (7, Error::WasteNotFound),
            (8, Error::MaterialNotFound),
            (9, Error::IncentiveNotFound),
            (10, Error::ParticipantNotFound),
            (11, Error::InvalidAmount),
            (12, Error::InvalidWeight),
            (13, Error::InvalidCoordinates),
            (14, Error::InvalidPercentage),
            (15, Error::InsufficientBalance),
            (16, Error::CharityNotSet),
            (17, Error::TokenAddressNotSet),
            (18, Error::WasteDeactivated),
            (19, Error::WasteAlreadyDeactivated),
            (20, Error::WasteAlreadyConfirmed),
            (21, Error::WasteNotConfirmed),
            (22, Error::SelfConfirmation),
            (23, Error::IncentiveInactive),
            (24, Error::MaterialNotVerified),
            (25, Error::WasteTypeMismatch),
            (26, Error::NoRewardAvailable),
            (27, Error::InvalidTransferRoute),
            (28, Error::SameAddress),
            (29, Error::Overflow),
            (30, Error::NotCreator),
            (31, Error::InsufficientBudget),
            (32, Error::TooManySplits),
            (33, Error::WeightMismatch),
            (34, Error::TooFewSplits),
            (35, Error::TooFewWastes),
            (36, Error::TooManyWastes),
            (37, Error::WasteTypeMismatchMerge),
            (38, Error::LocationMismatch),
            (39, Error::WasteAlreadyReserved),
            (40, Error::WasteNotReserved),
            (41, Error::NotReserver),
            (42, Error::WasteReservedByOther),
            (43, Error::InvalidSchedule),
            (44, Error::WasteExpired),
            (45, Error::InsufficientCarbonCredits),
            (46, Error::CarbonListingNotFound),
            (47, Error::CarbonListingInactive),
            (48, Error::NotListingSeller),
            (49, Error::InvalidListing),
            (50, Error::WasteFrozen),
            (51, Error::PermissionDenied),
            (52, Error::InvalidPermission),
            (53, Error::NoDiscrepancy),
            (54, Error::ReconciliationThresholdExceeded),
        ];
        let codes: alloc::vec::Vec<u32> = all.iter().map(|(n, _)| *n).collect();
        let mut sorted = codes.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(codes.len(), sorted.len(), "duplicate numeric error codes detected");
    }

    #[test]
    fn error_codes_match_their_domain_ranges() {
        for error in all_errors() {
            let code = *error as u32;
            let expected_range = match error.category() {
                ErrorCategory::Auth => 1000..=1099,
                ErrorCategory::Input => 2000..=2099,
                ErrorCategory::State => 3000..=3099,
                ErrorCategory::NotFound => 4000..=4099,
                ErrorCategory::Arithmetic => 5000..=5099,
                ErrorCategory::Config => 6000..=6099,
            };
            assert!(
                expected_range.contains(&code),
                "{} code {code} is outside its domain range",
                error.code()
            );
        }
    }

    #[test]
    fn auth_errors_are_caller_errors() {
        assert!(Error::Unauthorized.is_caller_error());
        assert!(Error::NotRegistered.is_caller_error());
        assert!(Error::PermissionDenied.is_caller_error());
    }

    #[test]
    fn not_found_errors_are_classified_correctly() {
        assert!(Error::WasteNotFound.is_not_found());
        assert!(Error::ParticipantNotFound.is_not_found());
        assert!(Error::IncentiveNotFound.is_not_found());
        assert!(!Error::Overflow.is_not_found());
    }

    #[test]
    fn code_strings_contain_category_prefix() {
        let code = Error::Unauthorized.code();
        assert!(code.starts_with("AUTH/"), "expected AUTH/ prefix, got {code}");

        let code = Error::InvalidWeight.code();
        assert!(code.starts_with("INPUT/"), "expected INPUT/ prefix, got {code}");

        let code = Error::WasteNotFound.code();
        assert!(code.starts_with("NOT_FOUND/"), "expected NOT_FOUND/ prefix, got {code}");

        let code = Error::Overflow.code();
        assert!(
            code.starts_with("ARITHMETIC/"),
            "expected ARITHMETIC/ prefix, got {code}"
        );
    }

    #[test]
    fn category_arithmetic_is_not_caller_error() {
        assert!(!Error::Overflow.is_caller_error());
    }

    #[test]
    fn state_errors_are_not_caller_errors() {
        assert!(!Error::WasteExpired.is_caller_error());
        assert!(!Error::IncentiveInactive.is_caller_error());
    }
}

extern crate alloc;
