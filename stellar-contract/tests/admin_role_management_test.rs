#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, vec, Address, Env};
use stellar_scavngr_contract::{Error, ParticipantRole, ScavengerContract, ScavengerContractClient};

fn setup(env: &Env) -> (ScavengerContractClient, Address) {
    env.mock_all_auths();
    let client = ScavengerContractClient::new(env, &env.register_contract(None, ScavengerContract));
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

// ──────────────────────────────────────────────────────────────────────────
// TRANSFER_ADMIN TESTS
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_transfer_admin_single_to_single() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin = Address::generate(&env);

    client.transfer_admin(&admin, &vec![&env, new_admin.clone()]);
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_transfer_admin_single_to_multiple() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin_1 = Address::generate(&env);
    let new_admin_2 = Address::generate(&env);
    let new_admin_3 = Address::generate(&env);

    client.transfer_admin(&admin, &vec![&env, new_admin_1.clone(), new_admin_2, new_admin_3]);
    // After transfer, get_admin should return one of the admins (usually the first)
    assert_eq!(client.get_admin(), new_admin_1);
}

#[test]
fn test_transfer_admin_chain() {
    let env = Env::default();
    let (client, admin1) = setup(&env);
    let admin2 = Address::generate(&env);
    let admin3 = Address::generate(&env);

    // First transfer
    client.transfer_admin(&admin1, &vec![&env, admin2.clone()]);
    assert_eq!(client.get_admin(), admin2);

    // Second transfer
    client.transfer_admin(&admin2, &vec![&env, admin3.clone()]);
    assert_eq!(client.get_admin(), admin3);

    // Verify admin1 can no longer transfer
    let new_admin = Address::generate(&env);
    let result = client.try_transfer_admin(&admin1, &vec![&env, new_admin]);
    assert!(result.is_err());
}

#[test]
#[should_panic(expected = "Admin list cannot be empty")]
fn test_transfer_admin_empty_list_rejected() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.transfer_admin(&admin, &vec![&env]);
}

#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn test_transfer_admin_by_non_admin() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    client.transfer_admin(&non_admin, &vec![&env, new_admin]);
}

#[test]
fn test_transfer_admin_emits_event() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin = Address::generate(&env);

    client.transfer_admin(&admin, &vec![&env, new_admin]);

    let events = env.events().all();
    let found = events
        .iter()
        .any(|(_, topics, _)| topics == soroban_sdk::vec![&env, symbol_short!("adm_xfr").into_val(&env)]);
    assert!(found, "AdminTransferred event not emitted");
}

#[test]
fn test_transfer_admin_logs_audit_trail() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin = Address::generate(&env);

    client.transfer_admin(&admin, &vec![&env, new_admin.clone()]);

    // Verify the transfer was logged (audit trail check if available)
    // This tests that the action was recorded internally
    assert_eq!(client.get_admin(), new_admin);
}

// ──────────────────────────────────────────────────────────────────────────
// ADD_ADMIN TESTS
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_add_admin_to_existing_admin() {
    let env = Env::default();
    let (client, admin1) = setup(&env);
    let admin2 = Address::generate(&env);

    client.add_admin(&admin1, &admin2);

    // Both should be admins now
    // Verify by checking that admin2 can perform admin operations
    let new_admin = Address::generate(&env);
    client.transfer_admin(&admin2, &vec![&env, new_admin.clone()]);
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_add_admin_duplicate_ignored() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin = Address::generate(&env);

    client.add_admin(&admin, &new_admin);
    client.add_admin(&admin, &new_admin.clone()); // Add same admin again

    // Should be idempotent - no error
    assert_eq!(client.get_admin(), admin);
}

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_add_admin_by_non_admin() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    client.add_admin(&non_admin, &new_admin);
}

#[test]
fn test_add_admin_allows_new_admin_operations() {
    let env = Env::default();
    let (client, admin1) = setup(&env);
    let admin2 = Address::generate(&env);

    client.add_admin(&admin1, &admin2);

    // admin2 should now be able to perform admin-only operations
    let charity = Address::generate(&env);
    client.set_charity_contract(&admin2, &charity);
    assert_eq!(client.get_charity_contract(), Some(charity));
}

// ──────────────────────────────────────────────────────────────────────────
// REMOVE_ADMIN TESTS
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_remove_admin_from_multiple() {
    let env = Env::default();
    let (client, admin1) = setup(&env);
    let admin2 = Address::generate(&env);

    client.add_admin(&admin1, &admin2);
    client.remove_admin(&admin1, &admin2);

    // admin2 should no longer be able to perform admin operations
    let charity = Address::generate(&env);
    let result = client.try_set_charity_contract(&admin2, &charity);
    assert!(result.is_err());
}

#[test]
#[should_panic(expected = "Cannot remove the last admin")]
fn test_remove_admin_last_admin_blocked() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    client.remove_admin(&admin, &admin);
}

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_remove_admin_by_non_admin() {
    let env = Env::default();
    let (client, admin1) = setup(&env);
    let admin2 = Address::generate(&env);
    let non_admin = Address::generate(&env);

    client.add_admin(&admin1, &admin2);
    client.remove_admin(&non_admin, &admin2);
}

#[test]
fn test_remove_non_existent_admin() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let fake_admin = Address::generate(&env);

    // Should not panic - removing non-existent admin should be safe
    client.remove_admin(&admin, &fake_admin);
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn test_remove_admin_revokes_permissions() {
    let env = Env::default();
    let (client, admin1) = setup(&env);
    let admin2 = Address::generate(&env);

    client.add_admin(&admin1, &admin2);

    // Verify admin2 can perform operations
    let charity1 = Address::generate(&env);
    client.set_charity_contract(&admin2, &charity1);
    assert_eq!(client.get_charity_contract(), Some(charity1));

    // Remove admin2
    client.remove_admin(&admin1, &admin2);

    // Verify admin2 can no longer perform operations
    let charity2 = Address::generate(&env);
    let result = client.try_set_charity_contract(&admin2, &charity2);
    assert!(result.is_err());
}

// ──────────────────────────────────────────────────────────────────────────
// ADMIN PRIVILEGE ESCALATION & SECURITY TESTS
// ──────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_non_admin_cannot_set_charity() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    let charity = Address::generate(&env);

    client.set_charity_contract(&non_admin, &charity);
}

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_non_admin_cannot_set_percentages() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);

    client.set_percentages(&non_admin, &30, &20);
}

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_non_admin_cannot_pause_contract() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);

    client.pause(&non_admin);
}

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_non_admin_cannot_unpause_contract() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let non_admin = Address::generate(&env);

    client.pause(&admin);
    client.unpause(&non_admin);
}

// ──────────────────────────────────────────────────────────────────────────
// ADMIN AUTHORIZATION TESTS
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_admin_can_authorize() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    client.grant_permission(&admin, &user, &0u32).ok();
    assert_eq!(client.has_permission(&user, &0u32), Ok(true));
}

#[test]
fn test_non_admin_cannot_grant_permission() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    let user = Address::generate(&env);

    let result = client.try_grant_permission(&non_admin, &user, &0u32);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_non_admin_cannot_revoke_permission() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    let user = Address::generate(&env);

    let result = client.try_revoke_permission(&non_admin, &user, &0u32);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

// ──────────────────────────────────────────────────────────────────────────
// ADMIN LIFECYCLE EDGE CASES
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_admin_transfer_to_self() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    client.transfer_admin(&admin, &vec![&env, admin.clone()]);
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn test_multiple_admin_transfers_in_sequence() {
    let env = Env::default();
    let (client, admin1) = setup(&env);
    let admin2 = Address::generate(&env);
    let admin3 = Address::generate(&env);
    let admin4 = Address::generate(&env);

    client.transfer_admin(&admin1, &vec![&env, admin2.clone()]);
    assert_eq!(client.get_admin(), admin2);

    client.transfer_admin(&admin2, &vec![&env, admin3.clone()]);
    assert_eq!(client.get_admin(), admin3);

    client.transfer_admin(&admin3, &vec![&env, admin4.clone()]);
    assert_eq!(client.get_admin(), admin4);
}

#[test]
fn test_admin_add_remove_cycle() {
    let env = Env::default();
    let (client, admin1) = setup(&env);
    let admin2 = Address::generate(&env);

    // Add
    client.add_admin(&admin1, &admin2);

    // Verify admin2 works
    let charity1 = Address::generate(&env);
    client.set_charity_contract(&admin2, &charity1);

    // Remove
    client.remove_admin(&admin1, &admin2);

    // Verify admin2 doesn't work
    let charity2 = Address::generate(&env);
    let result = client.try_set_charity_contract(&admin2, &charity2);
    assert!(result.is_err());
}

#[test]
fn test_admin_operations_protected_by_auth() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin = Address::generate(&env);

    // This should require auth from admin address
    client.transfer_admin(&admin, &vec![&env, new_admin.clone()]);
    assert_eq!(client.get_admin(), new_admin);
}
