#![cfg(test)]
use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

/// Standard test setup: returns (client, admin, recycler, collector, manufacturer)
pub fn setup_full(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let manufacturer = Address::generate(env);
    let name = soroban_sdk::symbol_short!("test");
    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &name, &0, &0);
    (client, admin, recycler, collector, manufacturer)
}

/// Register N recyclers and return their addresses
pub fn create_recyclers(env: &Env, client: &ScavengerContractClient<'_>, n: u32) -> std::vec::Vec<Address> {
    let name = soroban_sdk::symbol_short!("test");
    (0..n)
        .map(|_| {
            let addr = Address::generate(env);
            client.register_participant(&addr, &ParticipantRole::Recycler, &name, &0, &0);
            addr
        })
        .collect()
}

/// Submit waste via recycle_waste and return waste_id
pub fn submit_waste(client: &ScavengerContractClient<'_>, owner: &Address, waste_type: WasteType, weight: u64) -> u64 {
    client.recycle_waste(&waste_type, &weight, owner, &0, &0)
}

/// Assert a waste's submitter matches expected address
pub fn assert_waste_owner(client: &ScavengerContractClient<'_>, waste_id: u64, expected_owner: &Address) {
    let waste = client.get_waste(&waste_id).expect("waste not found");
    assert_eq!(
        &waste.submitter, expected_owner,
        "Waste {} submitter mismatch",
        waste_id
    );
}

/// Create an incentive and return its id
pub fn create_test_incentive(
    client: &ScavengerContractClient<'_>,
    manufacturer: &Address,
    waste_type: WasteType,
    reward: u64,
    budget: u64,
) -> u64 {
    client.create_incentive(manufacturer, &waste_type, &reward, &budget).id
}
