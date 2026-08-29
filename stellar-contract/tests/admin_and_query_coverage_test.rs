#![cfg(test)]
// Coverage for previously-untested public entry points (issue #927):
// add_admin, remove_admin, get_admins, get_metrics, get_participant_role_string,
// get_waste_type_string, get_transfers_from/to, get_waste_by_id.

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    env.mock_all_auths();
    let client = ScavengerContractClient::new(env, &env.register_contract(None, ScavengerContract));
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

// ── add_admin ─────────────────────────────────────────────────────────────

#[test]
fn test_add_admin_appends_new_address() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin = Address::generate(&env);

    client.add_admin(&admin, &new_admin);

    let admins = client.get_admins();
    assert_eq!(admins.len(), 2);
    assert!(admins.contains(&admin));
    assert!(admins.contains(&new_admin));
}

#[test]
fn test_add_admin_is_idempotent_for_existing_admin() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    client.add_admin(&admin, &admin);

    assert_eq!(client.get_admins().len(), 1);
}

#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn test_add_admin_rejects_non_admin_caller() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    client.add_admin(&non_admin, &new_admin);
}

// ── remove_admin ──────────────────────────────────────────────────────────

#[test]
fn test_remove_admin_removes_existing_address() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let second = Address::generate(&env);
    client.add_admin(&admin, &second);

    client.remove_admin(&admin, &second);

    let admins = client.get_admins();
    assert_eq!(admins.len(), 1);
    assert!(admins.contains(&admin));
    assert!(!admins.contains(&second));
}

#[test]
#[should_panic(expected = "Cannot remove the last admin")]
fn test_remove_admin_rejects_removing_last_admin() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    client.remove_admin(&admin, &admin);
}

#[test]
#[should_panic(expected = "Admin to remove not found")]
fn test_remove_admin_rejects_unknown_address() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let second = Address::generate(&env);
    client.add_admin(&admin, &second);

    let stranger = Address::generate(&env);
    client.remove_admin(&admin, &stranger);
}

// ── get_metrics ───────────────────────────────────────────────────────────

#[test]
fn test_get_metrics_tracks_waste_count_and_tokens() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    client.set_token_address(&admin, &token);

    let recycler = Address::generate(&env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &0, &0);

    let baseline = client.get_metrics();
    assert_eq!(baseline.total_wastes_count, 0);
    assert_eq!(baseline.total_tokens_earned, 0);

    client.submit_material(&WasteType::Plastic, &1_000, &recycler, &String::from_str(&env, ""));
    client.submit_material(&WasteType::Metal, &2_000, &recycler, &String::from_str(&env, ""));

    let after = client.get_metrics();
    assert_eq!(after.total_wastes_count, 2);
}

// ── string conversion helpers ─────────────────────────────────────────────

#[test]
fn test_get_waste_type_string_matches_all_variants() {
    let env = Env::default();
    let client = ScavengerContractClient::new(&env, &env.register_contract(None, ScavengerContract));

    assert_eq!(
        client.get_waste_type_string(&WasteType::Paper),
        String::from_str(&env, "PAPER")
    );
    assert_eq!(
        client.get_waste_type_string(&WasteType::PetPlastic),
        String::from_str(&env, "PETPLASTIC")
    );
    assert_eq!(
        client.get_waste_type_string(&WasteType::Plastic),
        String::from_str(&env, "PLASTIC")
    );
    assert_eq!(
        client.get_waste_type_string(&WasteType::Metal),
        String::from_str(&env, "METAL")
    );
    assert_eq!(
        client.get_waste_type_string(&WasteType::Glass),
        String::from_str(&env, "GLASS")
    );
}

#[test]
fn test_get_participant_role_string_matches_all_variants() {
    let env = Env::default();
    let client = ScavengerContractClient::new(&env, &env.register_contract(None, ScavengerContract));

    assert_eq!(
        client.get_participant_role_string(&ParticipantRole::Recycler),
        String::from_str(&env, "RECYCLER")
    );
    assert_eq!(
        client.get_participant_role_string(&ParticipantRole::Collector),
        String::from_str(&env, "COLLECTOR")
    );
    assert_eq!(
        client.get_participant_role_string(&ParticipantRole::Manufacturer),
        String::from_str(&env, "MANUFACTURER")
    );
}

// ── transfers_from / transfers_to (unimplemented indices) ────────────────

#[test]
fn test_get_transfers_from_and_to_currently_return_empty() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let someone = Address::generate(&env);

    // These indices are not yet implemented server-side; document current behaviour
    // so a future implementation change is a deliberate, visible test update.
    assert_eq!(client.get_transfers_from(&someone).len(), 0);
    assert_eq!(client.get_transfers_to(&someone).len(), 0);
}

// ── get_waste_by_id (v1 alias) ─────────────────────────────────────────────

#[test]
fn test_get_waste_by_id_matches_get_waste() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let recycler = Address::generate(&env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &0, &0);

    let material = client.submit_material(&WasteType::Glass, &3_000, &recycler, &String::from_str(&env, "d"));

    let by_id = client.get_waste_by_id(&material.id).unwrap();
    let by_get_waste = client.get_waste(&material.id).unwrap();
    assert_eq!(by_id, by_get_waste);
    assert_eq!(by_id.id, material.id);
}

#[test]
fn test_get_waste_by_id_returns_none_for_missing() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    assert_eq!(client.get_waste_by_id(&999), None);
}
