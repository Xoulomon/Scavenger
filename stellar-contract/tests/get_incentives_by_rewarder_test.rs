use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_get_incentives_by_rewarder_empty() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 0);
}

#[test]
fn test_get_incentives_by_rewarder_single() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 1);
    assert_eq!(incentives.get(0).unwrap().id, incentive.id);
    assert_eq!(incentives.get(0).unwrap().rewarder, manufacturer);
    assert_eq!(incentives.get(0).unwrap().waste_type, WasteType::Plastic);
    assert_eq!(incentives.get(0).unwrap().reward_points, 100);
    assert_eq!(incentives.get(0).unwrap().total_budget, 10000);
}

#[test]
fn test_get_incentives_by_rewarder_multiple() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    // Create multiple incentives for different waste types
    let incentive1 = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);
    let incentive2 = client.create_incentive(&manufacturer, &WasteType::Metal, &150, &15000);
    let incentive3 = client.create_incentive(&manufacturer, &WasteType::Paper, &80, &8000);

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 3);

    // Verify all incentives are returned
    let mut has_id1 = false;
    let mut has_id2 = false;
    let mut has_id3 = false;

    for incentive in incentives.iter() {
        if incentive.id == incentive1.id {
            has_id1 = true;
        }
        if incentive.id == incentive2.id {
            has_id2 = true;
        }
        if incentive.id == incentive3.id {
            has_id3 = true;
        }
        // Verify all belong to the same rewarder
        assert_eq!(incentive.rewarder, manufacturer);
    }

    assert!(has_id1);
    assert!(has_id2);
    assert!(has_id3);
}

#[test]
fn test_get_incentives_by_rewarder_multiple_manufacturers() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer1 = Address::generate(&env);
    let manufacturer2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer1,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr1"),
        &100,
        &200,
    );
    client.register_participant(
        &manufacturer2,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr2"),
        &300,
        &400,
    );

    // Create incentives for both manufacturers
    let incentive1 = client.create_incentive(&manufacturer1, &WasteType::Plastic, &100, &10000);
    let incentive2 = client.create_incentive(&manufacturer1, &WasteType::Metal, &150, &15000);
    let incentive3 = client.create_incentive(&manufacturer2, &WasteType::Plastic, &120, &12000);
    let incentive4 = client.create_incentive(&manufacturer2, &WasteType::Glass, &90, &9000);

    // Get incentives for manufacturer1
    let incentives1 = client.get_incentives_by_rewarder(&manufacturer1);
    assert_eq!(incentives1.len(), 2);
    assert!(incentives1.iter().all(|i| i.rewarder == manufacturer1));

    let mut has_id1 = false;
    let mut has_id2 = false;
    for incentive in incentives1.iter() {
        if incentive.id == incentive1.id {
            has_id1 = true;
        }
        if incentive.id == incentive2.id {
            has_id2 = true;
        }
    }
    assert!(has_id1);
    assert!(has_id2);

    // Get incentives for manufacturer2
    let incentives2 = client.get_incentives_by_rewarder(&manufacturer2);
    assert_eq!(incentives2.len(), 2);
    assert!(incentives2.iter().all(|i| i.rewarder == manufacturer2));

    let mut has_id3 = false;
    let mut has_id4 = false;
    for incentive in incentives2.iter() {
        if incentive.id == incentive3.id {
            has_id3 = true;
        }
        if incentive.id == incentive4.id {
            has_id4 = true;
        }
    }
    assert!(has_id3);
    assert!(has_id4);
}

#[test]
fn test_get_incentives_by_rewarder_includes_inactive() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    let incentive1 = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);
    let incentive2 = client.create_incentive(&manufacturer, &WasteType::Metal, &150, &15000);

    // Deactivate one incentive
    client.deactivate_incentive(&incentive1.id, &manufacturer);

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 2);

    // Verify both active and inactive incentives are returned
    let mut has_id1 = false;
    let mut has_id2 = false;
    for incentive in incentives.iter() {
        if incentive.id == incentive1.id {
            has_id1 = true;
        }
        if incentive.id == incentive2.id {
            has_id2 = true;
        }
    }
    assert!(has_id1);
    assert!(has_id2);

    // Verify the deactivated one is marked as inactive
    let deactivated = incentives.iter().find(|i| i.id == incentive1.id).unwrap();
    assert!(!deactivated.active);

    let active = incentives.iter().find(|i| i.id == incentive2.id).unwrap();
    assert!(active.active);
}

#[test]
fn test_get_incentives_by_rewarder_returns_full_structs() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    let created_incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 1);

    let returned_incentive = incentives.get(0).unwrap();

    // Verify all fields are present and correct
    assert_eq!(returned_incentive.id, created_incentive.id);
    assert_eq!(returned_incentive.rewarder, manufacturer);
    assert_eq!(returned_incentive.waste_type, WasteType::Plastic);
    assert_eq!(returned_incentive.reward_points, 100);
    assert_eq!(returned_incentive.total_budget, 10000);
    assert_eq!(returned_incentive.remaining_budget, 10000);
    assert!(returned_incentive.active);
    assert_eq!(returned_incentive.created_at, created_incentive.created_at);
}

#[test]
fn test_get_incentives_by_rewarder_unregistered_address() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let unregistered = Address::generate(&env);
    env.mock_all_auths();

    let incentives = client.get_incentives_by_rewarder(&unregistered);
    assert_eq!(incentives.len(), 0);
}

#[test]
fn test_get_incentives_by_rewarder_after_update() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);

    // Update the incentive
    client.update_incentive(&incentive.id, &200, &20000);

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 1);

    let updated_incentive = incentives.get(0).unwrap();
    assert_eq!(updated_incentive.reward_points, 200);
    assert_eq!(updated_incentive.total_budget, 20000);
}

#[test]
fn test_get_incentives_by_rewarder_preserves_order() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    // Create incentives in a specific order
    let incentive1 = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);
    let incentive2 = client.create_incentive(&manufacturer, &WasteType::Metal, &150, &15000);
    let incentive3 = client.create_incentive(&manufacturer, &WasteType::Paper, &80, &8000);

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 3);

    // Verify order is preserved (creation order)
    assert_eq!(incentives.get(0).unwrap().id, incentive1.id);
    assert_eq!(incentives.get(1).unwrap().id, incentive2.id);
    assert_eq!(incentives.get(2).unwrap().id, incentive3.id);
}

#[test]
fn test_get_incentives_by_rewarder_all_waste_types() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    // Create incentives for all waste types
    client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);
    client.create_incentive(&manufacturer, &WasteType::Metal, &150, &15000);
    client.create_incentive(&manufacturer, &WasteType::Paper, &80, &8000);
    client.create_incentive(&manufacturer, &WasteType::Glass, &120, &12000);
    client.create_incentive(&manufacturer, &WasteType::PetPlastic, &90, &9000);

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 5);

    // Verify all waste types are represented
    let mut has_plastic = false;
    let mut has_metal = false;
    let mut has_paper = false;
    let mut has_glass = false;
    let mut has_pet_plastic = false;

    for incentive in incentives.iter() {
        match incentive.waste_type {
            WasteType::Plastic => has_plastic = true,
            WasteType::Metal => has_metal = true,
            WasteType::Paper => has_paper = true,
            WasteType::Glass => has_glass = true,
            WasteType::PetPlastic => has_pet_plastic = true,
            WasteType::Organic | WasteType::Electronic => {}
        }
    }

    assert!(has_plastic);
    assert!(has_metal);
    assert!(has_paper);
    assert!(has_glass);
    assert!(has_pet_plastic);
}

#[test]
fn test_get_incentives_by_rewarder_no_side_effects() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);

    // Call multiple times
    let incentives1 = client.get_incentives_by_rewarder(&manufacturer);
    let incentives2 = client.get_incentives_by_rewarder(&manufacturer);
    let incentives3 = client.get_incentives_by_rewarder(&manufacturer);

    // Verify results are consistent
    assert_eq!(incentives1.len(), 1);
    assert_eq!(incentives2.len(), 1);
    assert_eq!(incentives3.len(), 1);

    assert_eq!(incentives1.get(0).unwrap().id, incentive.id);
    assert_eq!(incentives2.get(0).unwrap().id, incentive.id);
    assert_eq!(incentives3.get(0).unwrap().id, incentive.id);

    // Verify the incentive itself is unchanged
    let retrieved_incentive = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(retrieved_incentive.reward_points, 100);
    assert_eq!(retrieved_incentive.total_budget, 10000);
}

#[test]
fn test_get_incentives_by_rewarder_large_number() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    // Create 20 incentives
    for i in 0..20 {
        let waste_type = match i % 5 {
            0 => WasteType::Plastic,
            1 => WasteType::Metal,
            2 => WasteType::Paper,
            3 => WasteType::Glass,
            _ => WasteType::PetPlastic,
        };
        client.create_incentive(&manufacturer, &waste_type, &(100 + i * 10), &(10000 + i * 1000));
    }

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 20);

    // Verify all belong to the manufacturer
    for incentive in incentives.iter() {
        assert_eq!(incentive.rewarder, manufacturer);
    }
}

#[test]
fn test_get_incentives_by_rewarder_with_varying_budgets() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &100,
        &200,
    );

    // Create incentives with different budgets
    client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &5000);
    client.create_incentive(&manufacturer, &WasteType::Metal, &150, &15000);
    client.create_incentive(&manufacturer, &WasteType::Paper, &80, &25000);

    let incentives = client.get_incentives_by_rewarder(&manufacturer);
    assert_eq!(incentives.len(), 3);

    // Verify budgets are correctly stored
    let mut has_5000 = false;
    let mut has_15000 = false;
    let mut has_25000 = false;

    for incentive in incentives.iter() {
        if incentive.total_budget == 5000 {
            has_5000 = true;
        }
        if incentive.total_budget == 15000 {
            has_15000 = true;
        }
        if incentive.total_budget == 25000 {
            has_25000 = true;
        }
    }

    assert!(has_5000);
    assert!(has_15000);
    assert!(has_25000);
}
