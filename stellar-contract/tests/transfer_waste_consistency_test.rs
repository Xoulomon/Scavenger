/// Tests verifying consistent behavior between transfer_waste (v1) and transfer_waste_v2.
///
/// Key behavioral differences documented here:
/// - v1: waste_id u64, note String, returns Material, history under ("transfers", id)
/// - v2: waste_id u128, lat/lon i128, returns WasteTransfer, history under ("transfer_history", id)
/// - Both now: require registered participants, reject deactivated waste, enforce role routes
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let manufacturer = Address::generate(env);
    env.mock_all_auths();
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &0, &0);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &0,
        &0,
    );
    (client, recycler, collector, manufacturer)
}

// ── Consistent: both versions transfer ownership ──────────────────────────────

#[test]
fn test_v1_transfers_ownership() {
    let env = Env::default();
    let (client, recycler, collector, _) = setup(&env);
    let note = String::from_str(&env, "test");

    let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &note);
    let result = client.transfer_waste(&material.id, &recycler, &collector, &note);

    assert_eq!(result.submitter, collector);
}

#[test]
fn test_v2_transfers_ownership() {
    let env = Env::default();
    let (client, recycler, collector, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let transfer = client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);

    assert_eq!(transfer.from, recycler);
    assert_eq!(transfer.to, collector);
}

// ── Consistent: both reject unregistered sender ───────────────────────────────

#[test]
#[should_panic]
fn test_v1_rejects_unregistered_sender() {
    let env = Env::default();
    let (client, recycler, collector, _) = setup(&env);
    let note = String::from_str(&env, "test");
    let stranger = Address::generate(&env);
    env.mock_all_auths();

    let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &note);
    client.transfer_waste(&material.id, &stranger, &collector, &note);
}

#[test]
#[should_panic]
fn test_v2_rejects_unregistered_sender() {
    let env = Env::default();
    let (client, recycler, _, _) = setup(&env);
    let stranger = Address::generate(&env);
    env.mock_all_auths();

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &stranger, &recycler, &0, &0);
}

// ── Consistent: v2 rejects deactivated waste ─────────────────────────────────
// Note: v1 Material.is_active is set at creation and has no public deactivation
// path via the current API — deactivate_waste only operates on v2 (Waste) storage.

#[test]
#[should_panic(expected = "Error(Contract, #18)")]
fn test_v2_rejects_deactivated_waste() {
    let env = Env::default();
    let (client, recycler, collector, _) = setup(&env);

    client.initialize_admin(&recycler);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.deactivate_waste(&waste_id, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
}

// ── Consistent: both enforce valid role routes ────────────────────────────────

#[test]
#[should_panic(expected = "Invalid transfer")]
fn test_v1_rejects_invalid_role_route() {
    let env = Env::default();
    let (client, recycler, _, manufacturer) = setup(&env);
    // collector -> recycler is not a valid route
    let note = String::from_str(&env, "test");

    let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &note);
    // recycler -> manufacturer is valid, but manufacturer -> recycler is not
    client.transfer_waste(&material.id, &recycler, &manufacturer, &note);
    // now manufacturer tries to send back to recycler (invalid)
    client.transfer_waste(&material.id, &manufacturer, &recycler, &note);
}

#[test]
#[should_panic(expected = "Error(Contract, #27)")]
fn test_v2_rejects_invalid_role_route() {
    let env = Env::default();
    let (client, recycler, _, manufacturer) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &0, &0);
    // manufacturer -> recycler is not a valid route
    client.transfer_waste_v2(&waste_id, &manufacturer, &recycler, &0, &0);
}

// ── v2-only: records GPS coordinates ─────────────────────────────────────────

#[test]
fn test_v2_records_coordinates() {
    let env = Env::default();
    let (client, recycler, collector, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Metal, &2000, &recycler, &0, &0);
    let transfer = client.transfer_waste_v2(&waste_id, &recycler, &collector, &40_000_000, &-74_000_000);

    assert_eq!(transfer.latitude, 40_000_000);
    assert_eq!(transfer.longitude, -74_000_000);
}

// ── v2-only: updates participant_wastes index ─────────────────────────────────

#[test]
fn test_v2_updates_participant_wastes_index() {
    let env = Env::default();
    let (client, recycler, collector, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Metal, &2000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);

    let recycler_wastes = client.get_participant_wastes_v2(&recycler);
    let collector_wastes = client.get_participant_wastes_v2(&collector);

    assert!(!recycler_wastes.contains(waste_id));
    assert!(collector_wastes.contains(waste_id));
}
