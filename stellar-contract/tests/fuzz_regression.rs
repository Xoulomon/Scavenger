#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String as SorobanString};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

fn setup_recycler<'a>(env: &Env, client: &ScavengerContractClient<'a>) -> Address {
    let participant = Address::generate(env);
    client.register_participant(
        &participant,
        &ParticipantRole::Recycler,
        &symbol_short!("Reg"),
        &0i128,
        &0i128,
    );
    participant
}

#[test]
#[should_panic]
fn regression_zero_weight_submission() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let p = setup_recycler(&env, &client);
    let desc = SorobanString::from_str(&env, "zero");
    client.submit_material(&WasteType::Paper, &0u64, &p, &desc);
}

#[test]
#[should_panic]
fn regression_self_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let p = setup_recycler(&env, &client);
    let desc = SorobanString::from_str(&env, "self");
    let m = client.submit_material(&WasteType::Metal, &1000u64, &p, &desc);
    let note = SorobanString::from_str(&env, "self");
    client.transfer_waste(&m.id, &p, &p, &note);
}

#[test]
#[should_panic]
fn regression_transfer_nonexistent_waste() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("R"),
        &0i128,
        &0i128,
    );
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("C"),
        &0i128,
        &0i128,
    );

    let note = SorobanString::from_str(&env, "bad");
    client.transfer_waste(&99999u64, &recycler, &collector, &note);
}

#[test]
#[should_panic]
fn regression_unregistered_submit() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let unregistered = Address::generate(&env);
    let desc = SorobanString::from_str(&env, "unreg");
    client.submit_material(&WasteType::Paper, &1000u64, &unregistered, &desc);
}

#[test]
#[should_panic]
fn regression_double_registration() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let p = Address::generate(&env);
    client.register_participant(&p, &ParticipantRole::Recycler, &symbol_short!("First"), &0i128, &0i128);
    client.register_participant(&p, &ParticipantRole::Recycler, &symbol_short!("Again"), &0i128, &0i128);
}

#[test]
#[should_panic]
fn regression_double_admin_init() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    client.initialize_admin(&admin1);
    client.initialize_admin(&admin2);
}

#[test]
fn regression_max_valid_coordinates() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let p = Address::generate(&env);
    client.register_participant(
        &p,
        &ParticipantRole::Recycler,
        &symbol_short!("Max"),
        &90_000_000i128,
        &180_000_000i128,
    );
    assert!(client.is_participant_registered(&p));
}

#[test]
fn regression_min_valid_coordinates() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let p = Address::generate(&env);
    client.register_participant(
        &p,
        &ParticipantRole::Recycler,
        &symbol_short!("Min"),
        &-90_000_000i128,
        &-180_000_000i128,
    );
    assert!(client.is_participant_registered(&p));
}

#[test]
#[should_panic]
fn regression_non_manufacturer_incentive() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let recycler = Address::generate(&env);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("R"),
        &0i128,
        &0i128,
    );
    client.create_incentive(&recycler, &WasteType::Paper, &10u64, &1000u64);
}

#[test]
fn regression_transfer_changes_owner() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("R"),
        &0i128,
        &0i128,
    );
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("C"),
        &0i128,
        &0i128,
    );

    let desc = SorobanString::from_str(&env, "reg");
    let m = client.submit_material(&WasteType::Paper, &1000u64, &recycler, &desc);
    let note = SorobanString::from_str(&env, "t");
    let transferred = client.transfer_waste(&m.id, &recycler, &collector, &note);
    assert_eq!(transferred.submitter, collector);
}
