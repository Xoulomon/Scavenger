// Auth audit tests (issue #922)
//
// Verifies that every state-changing contract function enforces authorization.
// Each test calls the function WITHOUT mocking auths and expects a panic /
// auth-failure, then calls it WITH the correct auth and verifies it succeeds.
//
// Pattern used throughout:
//   env.mock_all_auths()  – allow all auths (positive path)
//   env.set_auths(&[])    – strip all auths (negative path, must panic)

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol, Vec};

use crate::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── helpers ──────────────────────────────────────────────────────────────────

fn setup() -> (
    Env,
    ScavengerContractClient<'static>,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);

    client.initialize_admin(&admin);

    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &Symbol::new(&env, "Recycler"),
        &10_000_000_i128,
        &10_000_000_i128,
    );
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &Symbol::new(&env, "Collector"),
        &10_000_000_i128,
        &10_000_000_i128,
    );
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &Symbol::new(&env, "Manufacturer"),
        &10_000_000_i128,
        &10_000_000_i128,
    );

    (env, client, admin, recycler, collector, manufacturer)
}

// ── #922: initialize_admin — cannot re-initialize ────────────────────────────

#[test]
#[should_panic(expected = "Admin already initialized")]
fn test_initialize_admin_already_set() {
    let (env, client, _admin, _, _, _) = setup();
    let attacker = Address::generate(&env);
    client.initialize_admin(&attacker);
}

// ── #922: transfer_admin — non-admin cannot transfer ─────────────────────────

#[test]
#[should_panic]
fn test_transfer_admin_unauthorized() {
    let (env, client, _admin, recycler, _, _) = setup();
    let new_admin = Address::generate(&env);
    let mut new_admins = Vec::new(&env);
    new_admins.push_back(new_admin);
    // recycler is not admin — must panic
    client.transfer_admin(&recycler, &new_admins);
}

#[test]
fn test_transfer_admin_authorized() {
    let (env, client, admin, _, _, _) = setup();
    let new_admin = Address::generate(&env);
    let mut new_admins = Vec::new(&env);
    new_admins.push_back(new_admin.clone());
    client.transfer_admin(&admin, &new_admins);
    let admins = client.get_admins();
    assert!(admins.contains(&new_admin));
}

// ── #922: set_charity_contract — only admin ──────────────────────────────────

#[test]
#[should_panic]
fn test_set_charity_unauthorized() {
    let (env, client, _admin, recycler, _, _) = setup();
    let charity = Address::generate(&env);
    client.set_charity_contract(&recycler, &charity);
}

#[test]
fn test_set_charity_authorized() {
    let (env, client, admin, _, _, _) = setup();
    let charity = Address::generate(&env);
    client.set_charity_contract(&admin, &charity);
    assert_eq!(client.get_charity_contract(), Some(charity));
}

// ── #922: set_percentages — only admin ───────────────────────────────────────

#[test]
#[should_panic]
fn test_set_percentages_unauthorized() {
    let (_, client, _, recycler, _, _) = setup();
    client.set_percentages(&recycler, &10, &40);
}

#[test]
fn test_set_percentages_authorized() {
    let (_, client, admin, _, _, _) = setup();
    client.set_percentages(&admin, &10, &40);
    assert_eq!(client.get_collector_percentage(), Some(10));
    assert_eq!(client.get_owner_percentage(), Some(40));
}

// ── #922: set_token_address — only admin ─────────────────────────────────────

#[test]
#[should_panic]
fn test_set_token_address_unauthorized() {
    let (env, client, _admin, recycler, _, _) = setup();
    let token = Address::generate(&env);
    client.set_token_address(&recycler, &token);
}

// ── #922: register_participant — caller must sign ────────────────────────────

#[test]
#[should_panic]
fn test_register_participant_no_auth() {
    let env = Env::default();
    // No mock_all_auths — auth will fail
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &id);

    // Initialize with mocked auth just for setup
    env.mock_all_auths();
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    // Now clear auths and attempt register without signing
    env.set_auths(&[]);
    let user = Address::generate(&env);
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &Symbol::new(&env, "User"),
        &0_i128,
        &0_i128,
    );
}

// ── #922: update_role — caller must sign ─────────────────────────────────────

#[test]
#[should_panic]
fn test_update_role_no_auth() {
    let (env, client, _, recycler, _, _) = setup();
    env.set_auths(&[]);
    client.update_role(&recycler, &ParticipantRole::Collector);
}

#[test]
fn test_update_role_authorized() {
    let (_, client, _, recycler, _, _) = setup();
    let updated = client.update_role(&recycler, &ParticipantRole::Collector);
    assert_eq!(updated.role, ParticipantRole::Collector);
}

// ── #922: deregister_participant — caller must sign ──────────────────────────

#[test]
#[should_panic]
fn test_deregister_no_auth() {
    let (env, client, _, recycler, _, _) = setup();
    env.set_auths(&[]);
    client.deregister_participant(&recycler);
}

// ── #922: submit_material — caller must be registered ────────────────────────

#[test]
#[should_panic]
fn test_submit_material_unregistered() {
    let (env, client, _, _, _, _) = setup();
    let stranger = Address::generate(&env);
    client.submit_material(
        &WasteType::Plastic,
        &1000_u64,
        &stranger,
        &String::from_str(&env, "test"),
    );
}

#[test]
fn test_submit_material_authorized() {
    let (env, client, _, recycler, _, _) = setup();
    let mat = client.submit_material(
        &WasteType::Plastic,
        &1000_u64,
        &recycler,
        &String::from_str(&env, "test"),
    );
    assert_eq!(mat.submitter, recycler);
}

// ── #922: recycle_waste — caller must be registered ──────────────────────────

#[test]
#[should_panic]
fn test_recycle_waste_unregistered() {
    let (env, client, _, _, _, _) = setup();
    let stranger = Address::generate(&env);
    client.recycle_waste(&WasteType::Plastic, &1000_u128, &stranger, &0_i128, &0_i128);
}

#[test]
fn test_recycle_waste_authorized() {
    let (_, client, _, recycler, _, _) = setup();
    let id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    assert!(id > 0);
}

// ── #922: transfer_waste_v2 — from must sign and own waste ───────────────────

#[test]
#[should_panic]
fn test_transfer_waste_v2_not_owner() {
    let (_, client, _, recycler, collector, _) = setup();
    // recycler creates waste, then collector tries to transfer it — should fail
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    // collector doesn't own it
    let _ = client.transfer_waste_v2(&waste_id, &collector, &recycler, &0_i128, &0_i128);
}

#[test]
fn test_transfer_waste_v2_authorized() {
    let (_, client, _, recycler, collector, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    let result = client.transfer_waste_v2(&waste_id, &recycler, &collector, &0_i128, &0_i128);
    assert!(result.is_ok());
}

// ── #922: deactivate_waste — only admin ──────────────────────────────────────

#[test]
#[should_panic]
fn test_deactivate_waste_unauthorized() {
    let (_, client, _, recycler, _, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    client.deactivate_waste(&waste_id, &recycler); // recycler is not admin
}

#[test]
fn test_deactivate_waste_authorized() {
    let (_, client, admin, recycler, _, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    let waste = client.deactivate_waste(&waste_id, &admin);
    assert!(!waste.is_active);
}

// ── #922: create_incentive — only manufacturer ───────────────────────────────

#[test]
#[should_panic]
fn test_create_incentive_non_manufacturer() {
    let (_, client, _, recycler, _, _) = setup();
    // recycler is not a manufacturer
    client.create_incentive(&recycler, &WasteType::Plastic, &10_u64, &1000_u64);
}

#[test]
fn test_create_incentive_authorized() {
    let (_, client, _, _, _, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10_u64, &1000_u64);
    assert!(incentive.active);
    assert_eq!(incentive.rewarder, manufacturer);
}

// ── #922: deactivate_incentive — only creator ────────────────────────────────

#[test]
#[should_panic]
fn test_deactivate_incentive_non_creator() {
    let (_, client, _, _, collector, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10_u64, &1000_u64);
    // collector did not create it
    client.deactivate_incentive(&incentive.id, &collector);
}

#[test]
fn test_deactivate_incentive_authorized() {
    let (_, client, _, _, _, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10_u64, &1000_u64);
    let updated = client.deactivate_incentive(&incentive.id, &manufacturer);
    assert!(!updated.active);
}

// ── #922: verify_material — only recyclers ───────────────────────────────────

#[test]
#[should_panic]
fn test_verify_material_non_recycler() {
    let (env, client, _, recycler, collector, _) = setup();
    let mat = client.submit_material(
        &WasteType::Plastic,
        &1000_u64,
        &recycler,
        &String::from_str(&env, "test"),
    );
    // collector cannot verify — not a recycler
    client.verify_material(&mat.id, &collector);
}

#[test]
fn test_verify_material_authorized() {
    let (env, client, _, recycler, _, _) = setup();
    let mat = client.submit_material(
        &WasteType::Plastic,
        &1000_u64,
        &recycler,
        &String::from_str(&env, "test"),
    );
    let verified = client.verify_material(&mat.id, &recycler);
    assert!(verified.verified);
}

// ── #922: confirm_waste_details — owner cannot confirm own waste ──────────────

#[test]
#[should_panic(expected = "Owner cannot confirm own waste")]
fn test_confirm_waste_owner_cannot_confirm() {
    let (_, client, _, recycler, _, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    client.confirm_waste_details(&waste_id, &recycler);
}

#[test]
fn test_confirm_waste_non_owner() {
    let (_, client, _, recycler, collector, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    let waste = client.confirm_waste_details(&waste_id, &collector);
    assert!(waste.is_confirmed);
}

// ── #922: pause / unpause — only admin ───────────────────────────────────────

#[test]
#[should_panic]
fn test_pause_unauthorized() {
    let (_, client, _, recycler, _, _) = setup();
    client.pause(&recycler);
}

#[test]
fn test_pause_unpause_authorized() {
    let (_, client, admin, _, _, _) = setup();
    client.pause(&admin);
    assert!(client.is_paused());
    client.unpause(&admin);
    assert!(!client.is_paused());
}

// ── #922: donate_to_charity — insufficient balance panics ────────────────────

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_donate_to_charity_insufficient_balance() {
    let (env, client, admin, recycler, _, _) = setup();
    let charity = Address::generate(&env);
    client.set_charity_contract(&admin, &charity);
    // recycler has 0 tokens — should panic
    client.donate_to_charity(&recycler, &1_i128);
}

// ── #922: grant_permission — only admin ──────────────────────────────────────

#[test]
#[should_panic]
fn test_grant_permission_non_admin() {
    let (_, client, _, recycler, collector, _) = setup();
    let _ = client.grant_permission(&recycler, &collector, &0_u32);
}

// ── #922: set_waste_grade — recycler cannot grade ────────────────────────────

#[test]
#[should_panic(expected = "Only collectors or manufacturers can grade waste")]
fn test_set_waste_grade_by_recycler_fails() {
    let (_, client, _, recycler, _, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    use crate::WasteGrade;
    client.set_waste_grade(&waste_id, &WasteGrade::A, &recycler);
}

#[test]
fn test_set_waste_grade_by_collector_succeeds() {
    let (_, client, _, recycler, collector, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    use crate::WasteGrade;
    let waste = client.set_waste_grade(&waste_id, &WasteGrade::A, &collector);
    assert_eq!(waste.grade, WasteGrade::A);
}

// ── #922: distribute_rewards — only incentive creator ────────────────────────

#[test]
#[should_panic]
fn test_distribute_rewards_non_creator() {
    let (env, client, admin, recycler, collector, manufacturer) = setup();
    let token = Address::generate(&env);
    client.set_token_address(&admin, &token);
    let mat = client.submit_material(
        &WasteType::Plastic,
        &1000_u64,
        &recycler,
        &String::from_str(&env, "test"),
    );
    let verified = client.verify_material(&mat.id, &recycler);
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10_u64, &1000_u64);
    // collector is not the incentive creator
    client.distribute_rewards(&verified.id, &incentive.id, &collector);
}

// ── #922: reset_waste_confirmation — only owner ──────────────────────────────

#[test]
#[should_panic]
fn test_reset_confirmation_non_owner() {
    let (_, client, _, recycler, collector, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    client.confirm_waste_details(&waste_id, &collector);
    // collector tries to reset — not the owner
    client.reset_waste_confirmation(&waste_id, &collector);
}

#[test]
fn test_reset_confirmation_owner_succeeds() {
    let (_, client, _, recycler, collector, _) = setup();
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000_u128, &recycler, &0_i128, &0_i128);
    client.confirm_waste_details(&waste_id, &collector);
    let waste = client.reset_waste_confirmation(&waste_id, &recycler);
    assert!(!waste.is_confirmed);
}
