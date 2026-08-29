#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavngrContractClient, WasteType};

#[test]
fn load_test_batch_waste_submission() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);

    // Simulate 100 waste submissions
    for i in 0..100 {
        let waste_id = client.submit_material(&recycler, &WasteType::Plastic, &(100u128 + i as u128), &0i32, &0i32);
        assert!(waste_id > 0);
    }

    let stats = client.get_stats(&recycler);
    assert_eq!(stats.total_wastes_submitted, 100u128);
}

#[test]
fn load_test_concurrent_transfers() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &"Collector".into(),
        &0i32,
        &0i32,
    );

    // Create 50 wastes and transfer them
    let mut waste_ids = Vec::new();
    for i in 0..50 {
        let waste_id = client.submit_material(&recycler, &WasteType::Metal, &(50u128 + i as u128), &0i32, &0i32);
        waste_ids.push(waste_id);
    }

    for waste_id in waste_ids {
        client.transfer_waste(&waste_id, &recycler, &collector, &0i32, &0i32, &"Batch transfer".into());
    }

    let collector_wastes = client.get_participant_wastes(&collector);
    assert_eq!(collector_wastes.len(), 50u32);
}

#[test]
fn load_test_multiple_incentives() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let manufacturer = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &"Manufacturer".into(),
        &0i32,
        &0i32,
    );

    // Create 30 incentives across different waste types
    let waste_types = vec![
        WasteType::Plastic,
        WasteType::Metal,
        WasteType::Paper,
        WasteType::Glass,
        WasteType::Electronic,
    ];

    for i in 0..30 {
        let waste_type = waste_types[i % waste_types.len()].clone();
        let incentive_id = client.create_incentive(
            &manufacturer,
            &waste_type,
            &(50u128 + i as u128),
            &(1000u128 + i as u128 * 100),
        );
        assert!(incentive_id > 0);
    }

    let active_incentives = client.get_active_incentives();
    assert!(active_incentives.len() >= 30u32);
}

#[test]
fn load_test_query_performance() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);

    // Create 200 wastes
    for i in 0..200 {
        client.submit_material(&recycler, &WasteType::Plastic, &(100u128 + i as u128), &0i32, &0i32);
    }

    // Query participant wastes multiple times
    for _ in 0..10 {
        let wastes = client.get_participant_wastes(&recycler);
        assert!(wastes.len() > 0);
    }

    let metrics = client.get_metrics();
    assert_eq!(metrics.total_wastes, 200u128);
}

#[test]
fn load_test_high_volume_transfers() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &"Collector".into(),
        &0i32,
        &0i32,
    );
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &"Manufacturer".into(),
        &0i32,
        &0i32,
    );

    // Create 75 wastes and move through supply chain
    for i in 0..75 {
        let waste_id = client.submit_material(&recycler, &WasteType::Plastic, &(100u128 + i as u128), &0i32, &0i32);

        client.transfer_waste(&waste_id, &recycler, &collector, &0i32, &0i32, &"To collector".into());

        client.transfer_waste(
            &waste_id,
            &collector,
            &manufacturer,
            &0i32,
            &0i32,
            &"To manufacturer".into(),
        );
    }

    let manufacturer_wastes = client.get_participant_wastes(&manufacturer);
    assert_eq!(manufacturer_wastes.len(), 75u32);
}
