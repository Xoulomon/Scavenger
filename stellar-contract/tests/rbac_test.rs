#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{Error, ParticipantRole, PermissionType, ScavengerContract, ScavengerContractClient};

fn setup(env: &Env) -> (ScavengerContractClient, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

// ── PermissionType constants ──────────────────────────────────────────────────
// 0 = Verifier, 1 = Auditor, 2 = Admin, 3 = IncentiveManager

// ── Grant / has_permission ────────────────────────────────────────────────────

#[test]
fn test_grant_and_check_permission() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    // Before grant – no permission
    assert_eq!(client.has_permission(&user, &0u32), Ok(false));

    client.grant_permission(&admin, &user, &0u32).unwrap();

    assert_eq!(client.has_permission(&user, &0u32), Ok(true));
}

#[test]
fn test_grant_all_permission_types() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    for perm in [0u32, 1u32, 2u32, 3u32] {
        let user = Address::generate(&env);
        client.grant_permission(&admin, &user, &perm).unwrap();
        assert_eq!(client.has_permission(&user, &perm), Ok(true));
    }
}

#[test]
fn test_permission_is_per_user_and_per_type() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);

    client.grant_permission(&admin, &user_a, &0u32).unwrap(); // Verifier

    // user_b should NOT have it
    assert_eq!(client.has_permission(&user_b, &0u32), Ok(false));
    // user_a should NOT have Auditor
    assert_eq!(client.has_permission(&user_a, &1u32), Ok(false));
}

// ── Revoke ────────────────────────────────────────────────────────────────────

#[test]
fn test_revoke_permission() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    client.grant_permission(&admin, &user, &1u32).unwrap();
    assert_eq!(client.has_permission(&user, &1u32), Ok(true));

    client.revoke_permission(&admin, &user, &1u32).unwrap();
    assert_eq!(client.has_permission(&user, &1u32), Ok(false));
}

#[test]
fn test_revoke_non_held_permission_does_not_error() {
    // Revoking a permission that was never granted should not panic/error
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    // Never granted – should still succeed (idempotent revoke)
    client.revoke_permission(&admin, &user, &2u32).unwrap();
    assert_eq!(client.has_permission(&user, &2u32), Ok(false));
}

// ── Audit trail ───────────────────────────────────────────────────────────────

#[test]
fn test_audit_trail_records_grant_and_revoke() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    client.grant_permission(&admin, &user, &3u32).unwrap();
    client.revoke_permission(&admin, &user, &3u32).unwrap();

    let trail = client.get_permission_audit(&user);
    assert_eq!(trail.len(), 2);

    let entry0 = trail.get(0).unwrap();
    assert!(entry0.granted);
    assert_eq!(entry0.permission, PermissionType::IncentiveManager);
    assert_eq!(entry0.changed_by, admin);

    let entry1 = trail.get(1).unwrap();
    assert!(!entry1.granted);
    assert_eq!(entry1.permission, PermissionType::IncentiveManager);
}

#[test]
fn test_audit_trail_empty_for_unknown_user() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let user = Address::generate(&env);

    let trail = client.get_permission_audit(&user);
    assert_eq!(trail.len(), 0);
}

#[test]
fn test_multiple_grants_accumulate_in_trail() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    client.grant_permission(&admin, &user, &0u32).unwrap();
    client.grant_permission(&admin, &user, &1u32).unwrap();
    client.grant_permission(&admin, &user, &2u32).unwrap();

    let trail = client.get_permission_audit(&user);
    assert_eq!(trail.len(), 3);
}

// ── Access control errors ─────────────────────────────────────────────────────

#[test]
fn test_non_admin_cannot_grant_permission() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    let user = Address::generate(&env);

    let result = client.try_grant_permission(&non_admin, &user, &0u32);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_non_admin_cannot_revoke_permission() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    let user = Address::generate(&env);

    let result = client.try_revoke_permission(&non_admin, &user, &0u32);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

// ── Invalid permission value ──────────────────────────────────────────────────

#[test]
fn test_grant_invalid_permission_type_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    let result = client.try_grant_permission(&admin, &user, &99u32);
    assert_eq!(result, Err(Ok(Error::InvalidPermission)));
}

#[test]
fn test_revoke_invalid_permission_type_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    let result = client.try_revoke_permission(&admin, &user, &99u32);
    assert_eq!(result, Err(Ok(Error::InvalidPermission)));
}

#[test]
fn test_has_permission_invalid_type_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let user = Address::generate(&env);

    let result = client.try_has_permission(&user, &99u32);
    assert_eq!(result, Err(Ok(Error::InvalidPermission)));
}

// ── Idempotency ───────────────────────────────────────────────────────────────

#[test]
fn test_double_grant_is_idempotent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    client.grant_permission(&admin, &user, &0u32).unwrap();
    client.grant_permission(&admin, &user, &0u32).unwrap(); // second grant

    // Still granted
    assert_eq!(client.has_permission(&user, &0u32), Ok(true));

    // Audit trail grows by 1 entry per call
    let trail = client.get_permission_audit(&user);
    assert_eq!(trail.len(), 2);
}

// ── Participant registration is not required ──────────────────────────────────

#[test]
fn test_grant_permission_to_unregistered_address() {
    // RBAC should work on any address, not just registered participants
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let unregistered = Address::generate(&env);

    // Should succeed without registering
    client.grant_permission(&admin, &unregistered, &0u32).unwrap();
    assert_eq!(client.has_permission(&unregistered, &0u32), Ok(true));
}

// ── Permission isolation across types ────────────────────────────────────────

#[test]
fn test_granting_one_permission_does_not_grant_others() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);

    client.grant_permission(&admin, &user, &0u32).unwrap(); // Verifier only

    assert_eq!(client.has_permission(&user, &0u32), Ok(true));
    assert_eq!(client.has_permission(&user, &1u32), Ok(false)); // Auditor
    assert_eq!(client.has_permission(&user, &2u32), Ok(false)); // Admin
    assert_eq!(client.has_permission(&user, &3u32), Ok(false)); // IncentiveManager
}
