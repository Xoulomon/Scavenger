#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, Address, Env,
};
use stellar_scavngr_contract::{Error, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    client.initialize_admin(&admin);

    let recycler = Address::generate(env);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("recycler"),
        &0,
        &0,
    );

    (client, admin, recycler)
}

fn register_collector(client: &ScavengerContractClient, env: &Env) -> Address {
    let collector = Address::generate(env);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("col"),
        &0,
        &0,
    );
    collector
}

// ── Happy-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_reserve_waste_sets_fields() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    let waste = client.reserve_waste(&waste_id, &collector, &3600u64);

    assert_eq!(waste.reserved_by, Some(collector));
    assert!(waste.reserved_until.is_some());
}

#[test]
fn test_cancel_reservation_by_reserver() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    client.reserve_waste(&waste_id, &collector, &3600u64);
    let waste = client.cancel_reservation(&waste_id, &collector);

    assert_eq!(waste.reserved_by, None);
    assert_eq!(waste.reserved_until, None);
}

#[test]
fn test_cancel_reservation_by_owner() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    client.reserve_waste(&waste_id, &collector, &3600u64);
    // Owner (recycler) cancels the reservation
    let waste = client.cancel_reservation(&waste_id, &recycler);

    assert_eq!(waste.reserved_by, None);
}

#[test]
fn test_transfer_to_reserver_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    client.reserve_waste(&waste_id, &collector, &3600u64);

    // Transfer to the reserver should succeed
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
}

#[test]
fn test_transfer_blocked_when_reserved_by_other() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector1 = register_collector(&client, &env);
    let collector2 = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    // collector1 reserves
    client.reserve_waste(&waste_id, &collector1, &3600u64);

    // Transfer to collector2 (not the reserver) should fail
    let result = client.try_transfer_waste_v2(&waste_id, &recycler, &collector2, &0, &0);
    assert_eq!(result, Err(Ok(Error::WasteReservedByOther)));
}

#[test]
fn test_expired_reservation_allows_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector1 = register_collector(&client, &env);
    let collector2 = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    // Reserve with duration=1 second
    client.reserve_waste(&waste_id, &collector1, &1u64);

    // Advance ledger time past the reservation expiry
    env.ledger().with_mut(|l| l.timestamp = l.timestamp + 100);

    // Transfer to a different collector should now succeed (reservation expired)
    client.transfer_waste_v2(&waste_id, &recycler, &collector2, &0, &0);
}

#[test]
fn test_expired_reservation_can_be_overwritten() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector1 = register_collector(&client, &env);
    let collector2 = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    client.reserve_waste(&waste_id, &collector1, &1u64);
    env.ledger().with_mut(|l| l.timestamp = l.timestamp + 100);

    // New reservation by collector2 should succeed after expiry
    let waste = client.reserve_waste(&waste_id, &collector2, &3600u64);
    assert_eq!(waste.reserved_by, Some(collector2));
}

// ── Error-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_reserve_waste_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _recycler) = setup(&env);

    let collector = register_collector(&client, &env);
    let result = client.try_reserve_waste(&9999u128, &collector, &3600u64);
    assert_eq!(result, Err(Ok(Error::WasteNotFound)));
}

#[test]
fn test_reserve_deactivated_waste() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, recycler) = setup(&env);

    let collector = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);
    client.deactivate_waste(&waste_id, &admin);

    let result = client.try_reserve_waste(&waste_id, &collector, &3600u64);
    assert_eq!(result, Err(Ok(Error::WasteDeactivated)));
}

#[test]
fn test_double_reservation_blocked() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector1 = register_collector(&client, &env);
    let collector2 = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    client.reserve_waste(&waste_id, &collector1, &3600u64);

    let result = client.try_reserve_waste(&waste_id, &collector2, &3600u64);
    assert_eq!(result, Err(Ok(Error::WasteAlreadyReserved)));
}

#[test]
fn test_cancel_not_reserved() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    let result = client.try_cancel_reservation(&waste_id, &recycler);
    assert_eq!(result, Err(Ok(Error::WasteNotReserved)));
}

#[test]
fn test_cancel_by_unauthorized_caller() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler) = setup(&env);

    let collector = register_collector(&client, &env);
    let stranger = register_collector(&client, &env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0, &0);

    client.reserve_waste(&waste_id, &collector, &3600u64);

    let result = client.try_cancel_reservation(&waste_id, &stranger);
    assert_eq!(result, Err(Ok(Error::NotReserver)));
}
