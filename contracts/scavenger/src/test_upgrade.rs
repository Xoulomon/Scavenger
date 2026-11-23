//! Upgrade/migration path tests — issue #1735.
//!
//! Covers:
//!   - CONTRACT_VERSION storage key constant correctness
//!   - `check_version_transition` logic (upgrade, downgrade, same, unknown)
//!   - `UpgradeProposal` lifecycle: propose → approve → execute / reject / cancel
//!   - `ProxyState` creation and version-guarded `update_implementation`
//!   - `UpgradeHistory` construction and field verification
//!   - `ApiVersion` helpers: `current()`, `is_deprecated()`, `as_u32()`
//!   - `UpgradeStatus::is_final()` for terminal states
//!   - Key non-collision with well-known existing keys

#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};

use crate::storage_keys::CONTRACT_VERSION;
use crate::upgrade::{ProxyState, UpgradeHistory, UpgradeProposal, UpgradeStatus};
use crate::versioning::{check_version_transition, ApiVersion};
use crate::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── Setup helper ──────────────────────────────────────────────────────────────

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    env.mock_all_auths();
    client.initialize_admin(&admin);
    (client, admin)
}

// ── Storage key constant tests ────────────────────────────────────────────────

/// CONTRACT_VERSION symbol must round-trip to the exact string "CTRCT_VER".
/// Pure constant test — no Env required.
#[test]
fn test_contract_version_key_has_correct_symbol() {
    assert_eq!(CONTRACT_VERSION.to_string(), "CTRCT_VER");
}

/// CONTRACT_VERSION symbol must be ≤ 9 characters (Soroban Symbol limit).
#[test]
fn test_contract_version_key_length_ok() {
    assert!(
        CONTRACT_VERSION.to_string().len() <= 9,
        "CONTRACT_VERSION symbol '{}' exceeds 9-char Soroban limit",
        CONTRACT_VERSION.to_string()
    );
}

/// CONTRACT_VERSION must not collide with the well-known existing keys.
#[test]
fn test_contract_version_key_not_colliding_with_existing_keys() {
    let ver = CONTRACT_VERSION.to_string();
    let existing = [
        "ADMINS",
        "PAUSED",
        "RWD_CFG",
        "TOT_WGT",
        "TOT_TKN",
        "RE_GUARD",
        "TKN_ADDR",
        "PART_IDX",
        "MS_THRESH",
        "PROP_CNT",
        "MIN_WGT",
        "CHARITY",
        "ANAL_BAT",
        "ANAL_UPD",
        "GMTR_SNAP",
    ];
    for key in &existing {
        assert_ne!(
            ver.as_str(),
            *key,
            "CONTRACT_VERSION collides with existing key '{}'",
            key
        );
    }
}

// ── version transition tests ──────────────────────────────────────────────────

/// V1 → V2 is a valid upgrade.
#[test]
fn test_version_transition_v1_to_v2_allowed() {
    assert_eq!(check_version_transition(1, 2), Ok(true));
}

/// V2 → V1 is a downgrade and must be rejected.
#[test]
fn test_version_transition_downgrade_rejected() {
    assert!(
        check_version_transition(2, 1).is_err(),
        "Downgrade from v2 to v1 should return Err"
    );
}

/// Same version is a no-op — not an error, but not an upgrade either.
#[test]
fn test_version_transition_same_version_noop() {
    assert_eq!(check_version_transition(1, 1), Ok(false));
}

/// An unknown target version must be rejected.
#[test]
fn test_version_transition_unknown_target_rejected() {
    assert!(
        check_version_transition(1, 99).is_err(),
        "Transition to unknown version 99 should return Err"
    );
}

// ── UpgradeProposal lifecycle tests ───────────────────────────────────────────

/// Full happy path: Proposed → Approved → Executed.
#[test]
fn test_upgrade_proposal_lifecycle() {
    let env = Env::default();
    let proposer = Address::generate(&env);
    let approver = Address::generate(&env);
    let impl_addr = Address::generate(&env);

    let mut proposal = UpgradeProposal::new(&env, 1, impl_addr, String::from_str(&env, "Upgrade to v2"), proposer, 2);

    assert_eq!(proposal.status, UpgradeStatus::Proposed);

    proposal.approve(&env, approver).expect("approve should succeed");
    assert_eq!(proposal.status, UpgradeStatus::Approved);

    proposal.execute(&env).expect("execute should succeed");
    assert_eq!(proposal.status, UpgradeStatus::Executed);
}

/// Proposed proposal can be rejected.
#[test]
fn test_upgrade_proposal_reject() {
    let env = Env::default();
    let proposer = Address::generate(&env);
    let impl_addr = Address::generate(&env);

    let mut proposal = UpgradeProposal::new(
        &env,
        2,
        impl_addr,
        String::from_str(&env, "Rejected upgrade"),
        proposer,
        2,
    );

    proposal.reject().expect("reject should succeed");
    assert_eq!(proposal.status, UpgradeStatus::Rejected);
}

/// Proposed proposal can be cancelled.
#[test]
fn test_upgrade_proposal_cancel_proposed() {
    let env = Env::default();
    let proposer = Address::generate(&env);
    let impl_addr = Address::generate(&env);

    let mut proposal = UpgradeProposal::new(
        &env,
        3,
        impl_addr,
        String::from_str(&env, "Cancelled upgrade"),
        proposer,
        2,
    );

    proposal.cancel().expect("cancel should succeed");
    assert_eq!(proposal.status, UpgradeStatus::Cancelled);
}

/// Executing a proposal that has not been approved must fail.
#[test]
fn test_upgrade_proposal_cannot_execute_without_approval() {
    let env = Env::default();
    let proposer = Address::generate(&env);
    let impl_addr = Address::generate(&env);

    let mut proposal = UpgradeProposal::new(
        &env,
        4,
        impl_addr,
        String::from_str(&env, "Not yet approved"),
        proposer,
        2,
    );

    let result = proposal.execute(&env);
    assert_eq!(
        result,
        Err("Proposal must be approved before execution"),
        "Executing a Proposed proposal must return the approval-required error"
    );
}

/// Cancelling an already-executed (finalized) proposal must fail.
#[test]
fn test_upgrade_proposal_cannot_cancel_finalized() {
    let env = Env::default();
    let proposer = Address::generate(&env);
    let approver = Address::generate(&env);
    let impl_addr = Address::generate(&env);

    let mut proposal = UpgradeProposal::new(
        &env,
        5,
        impl_addr,
        String::from_str(&env, "Already executed"),
        proposer,
        2,
    );

    proposal.approve(&env, approver).expect("approve should succeed");
    proposal.execute(&env).expect("execute should succeed");

    let result = proposal.cancel();
    assert!(
        result.is_err(),
        "Cancelling a finalized (Executed) proposal must return Err"
    );
}

// ── ProxyState tests ──────────────────────────────────────────────────────────

/// A newly created ProxyState starts at version 1.
#[test]
fn test_proxy_state_new() {
    let env = Env::default();
    let impl_addr = Address::generate(&env);
    let admin = Address::generate(&env);

    let state = ProxyState::new(&env, impl_addr, admin);
    assert_eq!(state.version, 1);
}

/// update_implementation advances the version.
#[test]
fn test_proxy_state_update_implementation() {
    let env = Env::default();
    let impl_v1 = Address::generate(&env);
    let impl_v2 = Address::generate(&env);
    let admin = Address::generate(&env);

    let mut state = ProxyState::new(&env, impl_v1, admin);
    state
        .update_implementation(&env, impl_v2, 2)
        .expect("upgrade to v2 should succeed");
    assert_eq!(state.version, 2);
}

/// update_implementation with an equal or lower version must be rejected.
#[test]
fn test_proxy_state_downgrade_rejected() {
    let env = Env::default();
    let impl_v1 = Address::generate(&env);
    let impl_same = Address::generate(&env);
    let admin = Address::generate(&env);

    let mut state = ProxyState::new(&env, impl_v1, admin);

    // Same version
    let result_same = state.update_implementation(&env, impl_same.clone(), 1);
    assert!(result_same.is_err(), "Updating to the same version must return Err");

    // Lower version (not reachable from 1 numerically, but guard still applies)
    // We test it generically: after advancing to v2, trying v1 must fail.
    state.version = 2;
    let result_lower = state.update_implementation(&env, impl_same, 1);
    assert!(
        result_lower.is_err(),
        "Downgrading the proxy implementation must return Err"
    );
}

// ── UpgradeHistory tests ──────────────────────────────────────────────────────

/// UpgradeHistory records the executor address passed at construction.
#[test]
fn test_upgrade_history_records_executor() {
    let env = Env::default();
    let prev_impl = Address::generate(&env);
    let new_impl = Address::generate(&env);
    let executor = Address::generate(&env);

    let history = UpgradeHistory::new(&env, 2, prev_impl, new_impl, executor.clone());
    assert_eq!(history.executed_by, executor);
    assert_eq!(history.version, 2);
}

// ── ApiVersion tests ──────────────────────────────────────────────────────────

/// ApiVersion::current() must return V2.
#[test]
fn test_api_version_current_is_v2() {
    assert_eq!(ApiVersion::current().as_u32(), 2);
}

/// ApiVersion::V1 must be flagged as deprecated.
#[test]
fn test_api_version_v1_deprecated() {
    assert!(ApiVersion::V1.is_deprecated());
}

// ── UpgradeStatus::is_final tests ─────────────────────────────────────────────

/// UpgradeStatus::Executed is a terminal (final) state.
#[test]
fn test_upgrade_status_is_final_for_executed() {
    assert!(UpgradeStatus::Executed.is_final());
}

/// UpgradeStatus::Proposed is not a terminal state.
#[test]
fn test_upgrade_status_proposed_is_not_final() {
    assert!(!UpgradeStatus::Proposed.is_final());
}

/// UpgradeStatus::Rejected is a terminal state.
#[test]
fn test_upgrade_status_rejected_is_final() {
    assert!(UpgradeStatus::Rejected.is_final());
}

/// UpgradeStatus::Cancelled is a terminal state.
#[test]
fn test_upgrade_status_cancelled_is_final() {
    assert!(UpgradeStatus::Cancelled.is_final());
}

// ── Contract-level integration smoke test ────────────────────────────────────

/// Smoke test: initialize_admin succeeds and the contract version is stored.
/// Verifies that `initialize_admin` writes `CONTRACT_VERSION` ("CTRCT_VER")
/// with the current API version (2) as required by issue #1735.
#[test]
fn test_contract_version_stored_on_initialize() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    // The key constant itself must have the correct symbol string.
    assert_eq!(CONTRACT_VERSION.to_string(), "CTRCT_VER");
    // After initialize_admin the contract must expose version == 2 (ApiVersion::V2).
    assert_eq!(client.get_contract_version(), 2u32);
}
