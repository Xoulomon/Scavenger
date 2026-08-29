#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    ParticipantRole, PendingTransferStatus, ScavengerContract, ScavengerContractClient, WasteType,
};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    client.initialize_admin(&admin);
    let name = symbol_short!("user");
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &1_000_000, &2_000_000);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &1_100_000, &2_100_000);
    (client, admin, recycler, collector)
}

fn submit_waste(client: &ScavengerContractClient<'_>, recycler: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &5_000u128, recycler, &1_000_000, &2_000_000)
}

#[test]
fn test_initiate_transfer() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    assert_eq!(pt.id, 1);
    assert_eq!(pt.status, PendingTransferStatus::Pending);
    assert_eq!(pt.waste_id, waste_id);
}

#[test]
fn test_approve_transfer_changes_ownership() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    let approved = client.approve_transfer(&pt.id, &collector);
    assert_eq!(approved.status, PendingTransferStatus::Approved);
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, collector);
}

#[test]
fn test_reject_transfer() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    let rejected = client.reject_transfer(&pt.id, &collector);
    assert_eq!(rejected.status, PendingTransferStatus::Rejected);
    // Waste still owned by recycler
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, recycler);
}

#[test]
#[should_panic(expected = "Only the recipient can approve")]
fn test_non_recipient_cannot_approve() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    client.approve_transfer(&pt.id, &recycler); // recycler tries to approve
}

#[test]
#[should_panic(expected = "Only the recipient can reject")]
fn test_non_recipient_cannot_reject() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    client.reject_transfer(&pt.id, &recycler);
}

#[test]
#[should_panic(expected = "Transfer is not pending")]
fn test_approve_already_approved_fails() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    client.approve_transfer(&pt.id, &collector);
    client.approve_transfer(&pt.id, &collector);
}

#[test]
#[should_panic(expected = "Transfer is not pending")]
fn test_reject_already_rejected_fails() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    client.reject_transfer(&pt.id, &collector);
    client.reject_transfer(&pt.id, &collector);
}

#[test]
fn test_expire_transfer() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    // Advance time past 24h
    env.ledger().with_mut(|l| l.timestamp += 86401);
    let expired = client.expire_transfer(&pt.id);
    assert_eq!(expired.status, PendingTransferStatus::Expired);
}

#[test]
#[should_panic(expected = "Transfer has not expired yet")]
fn test_expire_transfer_before_deadline_fails() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    client.expire_transfer(&pt.id);
}

#[test]
fn test_get_pending_transfer() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    let fetched = client.get_pending_transfer(&pt.id).unwrap();
    assert_eq!(fetched.id, pt.id);
    assert_eq!(fetched.from, recycler);
    assert_eq!(fetched.to, collector);
}

#[test]
fn test_get_pending_transfer_none_for_missing() {
    let env = Env::default();
    let (client, _, _, _) = setup(&env);
    assert!(client.get_pending_transfer(&999).is_none());
}

#[test]
#[should_panic(expected = "Caller is not the owner of this waste item")]
fn test_initiate_transfer_non_owner_fails() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    client.initiate_transfer(&waste_id, &collector, &recycler, &1_000_000, &2_000_000);
}

#[test]
fn test_transfer_expiry_timestamp_set_correctly() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);
    let waste_id = submit_waste(&client, &recycler);
    let now = env.ledger().timestamp();
    let pt = client.initiate_transfer(&waste_id, &recycler, &collector, &1_000_000, &2_000_000);
    assert_eq!(pt.expires_at, now + 86400);
}
