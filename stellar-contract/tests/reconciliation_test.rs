#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{Error, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);

    let owner = Address::generate(env);
    client.register_participant(&owner, &ParticipantRole::Recycler, &symbol_short!("owner"), &0, &0);
    (client, admin, owner)
}

fn make_waste(client: &ScavengerContractClient, owner: &Address, weight: u128) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &weight, owner, &0, &0)
}

fn reason(env: &Env) -> String {
    String::from_str(env, "scale calibration error")
}

// ── Happy-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_admin_can_reconcile_within_threshold() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);

    let record = client
        .reconcile_waste(&waste_id, &990u128, &admin, &reason(&env))
        .unwrap();

    assert_eq!(record.waste_id, waste_id);
    assert_eq!(record.original_weight, 1000);
    assert_eq!(record.adjusted_weight, 990);

    // Waste weight updated
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.weight, 990);
}

#[test]
fn test_reconcile_increase_weight_within_threshold() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);

    let record = client
        .reconcile_waste(&waste_id, &1050u128, &admin, &reason(&env))
        .unwrap();

    assert_eq!(record.original_weight, 1000);
    assert_eq!(record.adjusted_weight, 1050);
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.weight, 1050);
}

#[test]
fn test_exactly_10_percent_threshold_is_allowed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    // 10 % of 1000 = 100 → verified_weight = 900 (exactly 10% less)
    let waste_id = make_waste(&client, &owner, 1000);
    let record = client
        .reconcile_waste(&waste_id, &900u128, &admin, &reason(&env))
        .unwrap();

    assert_eq!(record.adjusted_weight, 900);
}

#[test]
fn test_reconcile_updates_audit_log() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);
    client
        .reconcile_waste(&waste_id, &950u128, &admin, &reason(&env))
        .unwrap();

    let log = client.get_reconciliation_log(&waste_id);
    assert_eq!(log.len(), 1);

    let entry = log.get(0).unwrap();
    assert_eq!(entry.waste_id, waste_id);
    assert_eq!(entry.original_weight, 1000);
    assert_eq!(entry.adjusted_weight, 950);
    assert_eq!(entry.reconciled_by, admin);
}

#[test]
fn test_multiple_reconciliations_accumulate_in_log() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);

    client
        .reconcile_waste(&waste_id, &950u128, &admin, &reason(&env))
        .unwrap();
    // Second reconcile from the new weight of 950
    client
        .reconcile_waste(&waste_id, &905u128, &admin, &reason(&env))
        .unwrap();

    let log = client.get_reconciliation_log(&waste_id);
    assert_eq!(log.len(), 2);
}

#[test]
fn test_auditor_can_reconcile() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let auditor = Address::generate(&env);
    // Grant Auditor permission (perm 1 = Auditor)
    client.grant_permission(&admin, &auditor, &1u32).unwrap();

    let waste_id = make_waste(&client, &owner, 1000);
    let record = client
        .reconcile_waste(&waste_id, &980u128, &auditor, &reason(&env))
        .unwrap();

    assert_eq!(record.adjusted_weight, 980);
}

#[test]
fn test_reconciliation_log_empty_before_any_reconciliation() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 500);
    let log = client.get_reconciliation_log(&waste_id);
    assert_eq!(log.len(), 0);
}

// ── Error-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_reconcile_nonexistent_waste_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _owner) = setup(&env);

    let result = client.try_reconcile_waste(&9999u128, &900u128, &admin, &reason(&env));
    assert_eq!(result, Err(Ok(Error::WasteNotFound)));
}

#[test]
fn test_reconcile_deactivated_waste_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);
    client.deactivate_waste(&waste_id, &admin);

    let result = client.try_reconcile_waste(&waste_id, &990u128, &admin, &reason(&env));
    assert_eq!(result, Err(Ok(Error::WasteDeactivated)));
}

#[test]
fn test_reconcile_no_discrepancy_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);

    // Same weight — nothing to reconcile
    let result = client.try_reconcile_waste(&waste_id, &1000u128, &admin, &reason(&env));
    assert_eq!(result, Err(Ok(Error::NoDiscrepancy)));
}

#[test]
fn test_reconcile_exceeds_threshold_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);

    // 11 % discrepancy – must be rejected
    let result = client.try_reconcile_waste(&waste_id, &889u128, &admin, &reason(&env));
    assert_eq!(result, Err(Ok(Error::ReconciliationThresholdExceeded)));
}

#[test]
fn test_reconcile_above_threshold_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);

    // 15 % above original
    let result = client.try_reconcile_waste(&waste_id, &1150u128, &admin, &reason(&env));
    assert_eq!(result, Err(Ok(Error::ReconciliationThresholdExceeded)));
}

#[test]
fn test_non_admin_non_auditor_cannot_reconcile() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);

    let stranger = Address::generate(&env);
    let result = client.try_reconcile_waste(&waste_id, &990u128, &stranger, &reason(&env));
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_verifier_permission_cannot_reconcile() {
    // Only Admin or Auditor role can reconcile – Verifier should be rejected
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let verifier = Address::generate(&env);
    client.grant_permission(&admin, &verifier, &0u32).unwrap(); // 0 = Verifier

    let waste_id = make_waste(&client, &owner, 1000);

    let result = client.try_reconcile_waste(&waste_id, &990u128, &verifier, &reason(&env));
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_reconcile_exactly_one_gram_below_threshold() {
    // diff = 101, which is > 10% of 1000. Should fail.
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);

    let result = client.try_reconcile_waste(&waste_id, &899u128, &admin, &reason(&env));
    assert_eq!(result, Err(Ok(Error::ReconciliationThresholdExceeded)));
}

#[test]
fn test_reconcile_reason_stored_in_record() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = make_waste(&client, &owner, 1000);
    let custom_reason = String::from_str(&env, "sensor drift detected");

    client
        .reconcile_waste(&waste_id, &970u128, &admin, &custom_reason)
        .unwrap();

    let log = client.get_reconciliation_log(&waste_id);
    let entry = log.get(0).unwrap();
    assert_eq!(entry.reason, custom_reason);
}
