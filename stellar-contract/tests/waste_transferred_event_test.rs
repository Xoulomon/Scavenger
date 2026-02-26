use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    Address, Env, IntoVal, String, TryIntoVal, Vec,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_waste_transferred_event_emitted() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("recycler"),
        &100,
        &200,
    );
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("collector"),
        &300,
        &400,
    );

    let material = client.submit_material(
        &WasteType::Plastic,
        &2500,
        &recycler,
        &String::from_str(&env, "Transfer test"),
    );
    let waste_id = material.id;

    client.transfer_waste(
        &waste_id,
        &recycler,
        &collector,
        &String::from_str(&env, "Transfer note"),
    );

    let events = env.events().all();
    let event = events.last().unwrap();

    let expected_topics: Vec<soroban_sdk::Val> = (
        symbol_short!("transfer"),
        waste_id,
    ).into_val(&env);
    
    assert_eq!(event.1, expected_topics);

    let event_data: (Address, Address) = event.2.try_into_val(&env).unwrap();
    assert_eq!(event_data.0, recycler);
    assert_eq!(event_data.1, collector);
}
