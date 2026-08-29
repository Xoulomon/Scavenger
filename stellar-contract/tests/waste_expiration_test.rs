#![cfg(test)]
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let manufacturer = Address::generate(env);
    let name = soroban_sdk::symbol_short!("u");
    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &name, &0, &0);
    (client, admin, recycler, collector, manufacturer)
}

// ── 1. TTL defaults to 0 (no expiry) ─────────────────────────────────────────

#[test]
fn test_default_ttl_is_zero() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);
    assert_eq!(client.get_waste_ttl(&WasteType::Plastic), 0);
}

// ── 2. set_waste_ttl persists the value ───────────────────────────────────────

#[test]
fn test_set_and_get_waste_ttl() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &3600);
    assert_eq!(client.get_waste_ttl(&WasteType::Plastic), 3600);
    // Other types unaffected
    assert_eq!(client.get_waste_ttl(&WasteType::Metal), 0);
}

// ── 3. set_waste_ttl rejects non-admin ────────────────────────────────────────

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_set_waste_ttl_non_admin_rejected() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    client.set_waste_ttl(&recycler, &WasteType::Plastic, &3600);
}

// ── 4. Waste registered without TTL has expires_at = 0 ───────────────────────

#[test]
fn test_waste_without_ttl_has_no_expiry() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    let id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let waste = client.get_waste_v2(&id).unwrap();
    assert_eq!(waste.expires_at, 0);
}

// ── 5. Waste registered with TTL has correct expires_at ──────────────────────

#[test]
fn test_waste_with_ttl_has_correct_expires_at() {
    let env = Env::default();
    let (client, admin, recycler, _, _) = setup(&env);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &1000);
    let now = env.ledger().timestamp();
    let id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let waste = client.get_waste_v2(&id).unwrap();
    assert_eq!(waste.expires_at, now + 1000);
}

// ── 6. Transfer of non-expired waste succeeds ────────────────────────────────

#[test]
fn test_transfer_non_expired_waste_succeeds() {
    let env = Env::default();
    let (client, admin, recycler, collector, _) = setup(&env);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &9999);
    let id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    // Transfer before expiry — should succeed
    let result = client.transfer_waste_v2(&id, &recycler, &collector, &0, &0);
    assert_eq!(result.to, collector);
}

// ── 7. Transfer of expired waste returns WasteExpired error ──────────────────

#[test]
fn test_transfer_expired_waste_fails() {
    let env = Env::default();
    let (client, admin, recycler, collector, _) = setup(&env);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);
    let id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);

    // Advance ledger past TTL
    env.ledger().with_mut(|li| {
        li.timestamp += 200;
    });

    let result = client.try_transfer_waste_v2(&id, &recycler, &collector, &0, &0);
    assert!(result.is_err());
}

// ── 8. get_expired_wastes returns only expired active items ──────────────────

#[test]
fn test_get_expired_wastes() {
    let env = Env::default();
    let (client, admin, recycler, _, _) = setup(&env);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);

    let id1 = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let id2 = client.recycle_waste(&WasteType::Metal, &1000, &recycler, &0, &0); // no TTL

    env.ledger().with_mut(|li| {
        li.timestamp += 200;
    });

    let expired = client.get_expired_wastes();
    assert_eq!(expired.len(), 1);
    assert_eq!(expired.get(0).unwrap(), id1);
    // id2 has no TTL so it should not appear
    assert!(!expired.contains(&id2));
}

// ── 9. cleanup_expired_wastes deactivates expired items and returns count ─────

#[test]
fn test_cleanup_expired_wastes() {
    let env = Env::default();
    let (client, admin, recycler, _, _) = setup(&env);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);

    let id1 = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let id2 = client.recycle_waste(&WasteType::Plastic, &2000, &recycler, &0, &0);
    let id3 = client.recycle_waste(&WasteType::Metal, &1000, &recycler, &0, &0); // no TTL

    env.ledger().with_mut(|li| {
        li.timestamp += 200;
    });

    let count = client.cleanup_expired_wastes(&admin);
    assert_eq!(count, 2);

    assert!(!client.get_waste_v2(&id1).unwrap().is_active);
    assert!(!client.get_waste_v2(&id2).unwrap().is_active);
    assert!(client.get_waste_v2(&id3).unwrap().is_active); // unaffected
}

// ── 10. cleanup_expired_wastes rejects non-admin ─────────────────────────────

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_cleanup_expired_wastes_non_admin_rejected() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    client.cleanup_expired_wastes(&recycler);
}

// ── 11. Already-deactivated expired waste is not double-counted ──────────────

#[test]
fn test_cleanup_skips_already_deactivated() {
    let env = Env::default();
    let (client, admin, recycler, _, _) = setup(&env);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);

    let id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.deactivate_waste(&id, &admin); // manually deactivate first

    env.ledger().with_mut(|li| {
        li.timestamp += 200;
    });

    let count = client.cleanup_expired_wastes(&admin);
    assert_eq!(count, 0); // already inactive, should be skipped
}

// ── 12. batch_transfer rejects if any item is expired ────────────────────────

#[test]
fn test_batch_transfer_rejects_expired_waste() {
    let env = Env::default();
    let (client, admin, recycler, collector, _) = setup(&env);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);

    let id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    env.ledger().with_mut(|li| {
        li.timestamp += 200;
    });

    let mut ids = soroban_sdk::Vec::new(&env);
    ids.push_back(id);
    let result = client.try_batch_transfer_waste(&ids, &collector, &0, &0);
    assert!(result.is_err());
}
