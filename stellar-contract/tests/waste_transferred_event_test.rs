use soroban_sdk::{
    symbol_short, testutils::{Address as _, Events}, Address, Env, IntoVal, String, Vec,
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

    client.register_participant(&recycler, &ParticipantRole::Recycler, &String::from_str(&env, "Recycler"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &String::from_str(&env, "Collector"), &300, &400);

    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &2500,
        &recycler,
        &40_000_000,
        &-74_000_000,
    );

    client.transfer_waste(
        &waste_id, 
        &recycler, 
        &collector, 
        &String::from_str(&env, "Transfer note")
    );

    let events = env.events().all();
    let event = events.last().unwrap();

    let expected_topics: Vec<soroban_sdk::Val> = (
        symbol_short!("transfer"),
        waste_id,
    ).into_val(&env);
    
    assert_eq!(event.topics, expected_topics);

    let event_data: (Address, Address) = event.data.try_into_val(&env).unwrap();
    assert_eq!(event_data.0, recycler);
    assert_eq!(event_data.1, collector);
}
