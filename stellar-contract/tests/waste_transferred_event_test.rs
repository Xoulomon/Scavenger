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

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);

    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &2500,
        &recycler,
        &40_000_000,
        &-74_000_000,
    );

    client.transfer_waste_v2(
        &waste_id, 
        &recycler, 
        &collector,
        &41_000_000,
        &-75_000_000,
    );

    let events = env.events().all();
    let event = events.last().unwrap();

    let expected_topics: Vec<soroban_sdk::Val> = (
        symbol_short!("transfer"),
        waste_id,
    ).into_val(&env);
    
    assert_eq!(event.0, contract_id);
    assert_eq!(event.1, expected_topics);
}
