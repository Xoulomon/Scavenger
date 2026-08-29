#![cfg(test)]

use soroban_sdk::{testutils::Address as _, vec, Address, Env, Vec};
use stellar_scavngr_contract::{
    MaterialComposition, ParticipantRole, ProcessingStatus, ScavengerContract, ScavengerContractClient, WasteType,
};

fn setup_contract(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);

    client.initialize_admin(&admin);

    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("recycler"),
        &1_000_000,
        &2_000_000,
    );

    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("collect"),
        &1_000_000,
        &2_000_000,
    );

    (client, admin, recycler, collector)
}

fn submit_waste(client: &ScavengerContractClient, recycler: &Address, waste_type: WasteType, weight: u128) -> u128 {
    client.recycle_waste(&waste_type, &weight, recycler, &1_000_000, &2_000_000)
}

// ========== Processing Costs Tests ==========

#[test]
fn test_set_processing_cost() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);

    let result = client.set_processing_cost(&waste_id, &recycler, &1000u128);
    assert_eq!(result.processing_cost, 1000);
}

#[test]
fn test_set_processing_cost_only_owner() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);

    let result = client.try_set_processing_cost(&waste_id, &collector, &1000u128);
    assert!(result.is_err());
}

#[test]
fn test_get_total_processing_costs() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id1 = submit_waste(&client, &recycler, WasteType::Plastic, 5000);
    let waste_id2 = submit_waste(&client, &recycler, WasteType::Metal, 3000);

    client.set_processing_cost(&waste_id1, &recycler, &1000u128);
    client.set_processing_cost(&waste_id2, &recycler, &500u128);

    let total = client.get_total_processing_costs();
    assert_eq!(total, 1500);
}

#[test]
fn test_get_participant_processing_costs() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);
    client.set_processing_cost(&waste_id, &recycler, &2000u128);

    let participant_costs = client.get_participant_processing_costs(&recycler);
    assert_eq!(participant_costs, 2000);
}

#[test]
fn test_processing_cost_accumulates_across_wastes() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id1 = submit_waste(&client, &recycler, WasteType::Plastic, 5000);
    let waste_id2 = submit_waste(&client, &recycler, WasteType::Metal, 3000);

    client.set_processing_cost(&waste_id1, &recycler, &1000u128);
    client.set_processing_cost(&waste_id2, &recycler, &1500u128);

    let participant_costs = client.get_participant_processing_costs(&recycler);
    assert_eq!(participant_costs, 2500);
}

#[test]
fn test_processing_cost_zero_by_default() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.processing_cost, 0);
}

#[test]
fn test_processing_cost_can_be_updated() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);

    client.set_processing_cost(&waste_id, &recycler, &1000u128);
    client.set_processing_cost(&waste_id, &recycler, &2000u128);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.processing_cost, 2000);
}

// ========== Material Composition Tests ==========

#[test]
fn test_set_waste_composition() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Electronic, 5000);

    let composition = vec![
        &env,
        MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 60,
        },
        MaterialComposition {
            material_type: WasteType::Plastic,
            percentage: 30,
        },
        MaterialComposition {
            material_type: WasteType::Glass,
            percentage: 10,
        },
    ];

    let result = client.set_waste_composition(&waste_id, &collector, &composition);
    assert_eq!(result.composition.len(), 3);
}

#[test]
fn test_composition_percentages_must_sum_to_100() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Electronic, 5000);

    let composition = vec![
        &env,
        MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 60,
        },
        MaterialComposition {
            material_type: WasteType::Plastic,
            percentage: 30,
        },
        // Missing 10% - should fail
    ];

    let result = client.try_set_waste_composition(&waste_id, &collector, &composition);
    assert!(result.is_err());
}

#[test]
fn test_composition_max_10_materials() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Electronic, 5000);

    let mut composition = Vec::new(&env);
    for _ in 0..11 {
        composition.push_back(MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 9,
        });
    }

    let result = client.try_set_waste_composition(&waste_id, &collector, &composition);
    assert!(result.is_err());
}

#[test]
fn test_only_verifiers_can_set_composition() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Electronic, 5000);

    let composition = vec![
        &env,
        MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 100,
        },
    ];

    // Recycler should not be able to set composition
    let result = client.try_set_waste_composition(&waste_id, &recycler, &composition);
    assert!(result.is_err());
}

#[test]
fn test_get_wastes_by_composition() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector) = setup_contract(&env);

    let waste_id1 = submit_waste(&client, &recycler, WasteType::Electronic, 5000);
    let waste_id2 = submit_waste(&client, &recycler, WasteType::Electronic, 3000);

    let composition1 = vec![
        &env,
        MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 70,
        },
        MaterialComposition {
            material_type: WasteType::Plastic,
            percentage: 30,
        },
    ];

    let composition2 = vec![
        &env,
        MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 40,
        },
        MaterialComposition {
            material_type: WasteType::Plastic,
            percentage: 60,
        },
    ];

    client.set_waste_composition(&waste_id1, &collector, &composition1);
    client.set_waste_composition(&waste_id2, &collector, &composition2);

    // Only waste_id1 has >= 50% metal
    let results = client.get_wastes_by_composition(&WasteType::Metal, &50);
    assert_eq!(results.len(), 1);
    assert_eq!(results.get(0).unwrap(), waste_id1);
}

#[test]
fn test_composition_empty_by_default() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.composition.len(), 0);
}

#[test]
fn test_composition_can_be_updated() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Electronic, 5000);

    let composition1 = vec![
        &env,
        MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 100,
        },
    ];

    let composition2 = vec![
        &env,
        MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 50,
        },
        MaterialComposition {
            material_type: WasteType::Plastic,
            percentage: 50,
        },
    ];

    client.set_waste_composition(&waste_id, &collector, &composition1);
    client.set_waste_composition(&waste_id, &collector, &composition2);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.composition.len(), 2);
}

#[test]
fn test_composition_single_material_100_percent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Metal, 5000);

    let composition = vec![
        &env,
        MaterialComposition {
            material_type: WasteType::Metal,
            percentage: 100,
        },
    ];

    let result = client.set_waste_composition(&waste_id, &collector, &composition);
    assert_eq!(result.composition.len(), 1);
}

// ========== Recycling Goals Tests ==========

#[test]
fn test_set_recycling_goal() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let target_weight: u128 = 100_000;
    let target_date = env.ledger().timestamp() + (60 * 24 * 60 * 60);

    client.set_recycling_goal(&recycler, &target_weight, &target_date, &None);

    let goals = client.get_goal_progress(&recycler);
    assert_eq!(goals.len(), 1);
    assert_eq!(goals.get(0).unwrap().target_weight, target_weight);
}

#[test]
fn test_goal_with_specific_waste_type() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let target_date = env.ledger().timestamp() + (60 * 24 * 60 * 60);

    client.set_recycling_goal(&recycler, &50_000u128, &target_date, &Some(WasteType::Plastic));

    let goals = client.get_goal_progress(&recycler);
    assert_eq!(goals.get(0).unwrap().waste_type, Some(WasteType::Plastic));
}

#[test]
fn test_max_5_active_goals() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let target_date = env.ledger().timestamp() + (60 * 24 * 60 * 60);

    for i in 0..5u128 {
        client.set_recycling_goal(&recycler, &(10_000 * (i + 1)), &target_date, &None);
    }

    // 6th goal should fail
    let result = client.try_set_recycling_goal(&recycler, &100_000u128, &target_date, &None);
    assert!(result.is_err());
}

#[test]
fn test_goal_duration_too_short_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    // Less than 1 month
    let too_short = env.ledger().timestamp() + (15 * 24 * 60 * 60);
    let result = client.try_set_recycling_goal(&recycler, &100_000u128, &too_short, &None);
    assert!(result.is_err());
}

#[test]
fn test_goal_duration_too_long_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    // More than 12 months
    let too_long = env.ledger().timestamp() + (400 * 24 * 60 * 60);
    let result = client.try_set_recycling_goal(&recycler, &100_000u128, &too_long, &None);
    assert!(result.is_err());
}

#[test]
fn test_goal_progress_tracking() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let target_date = env.ledger().timestamp() + (60 * 24 * 60 * 60);
    client.set_recycling_goal(&recycler, &10_000u128, &target_date, &Some(WasteType::Plastic));

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Recycled);

    let goals = client.get_goal_progress(&recycler);
    assert_eq!(goals.get(0).unwrap().current_weight, 5000);
}

#[test]
fn test_goal_achievement() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let target_date = env.ledger().timestamp() + (60 * 24 * 60 * 60);
    client.set_recycling_goal(&recycler, &5_000u128, &target_date, &Some(WasteType::Plastic));

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Recycled);

    let goals = client.get_goal_progress(&recycler);
    assert!(goals.get(0).unwrap().achieved);
}

#[test]
fn test_get_participants_meeting_goals() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let target_date = env.ledger().timestamp() + (60 * 24 * 60 * 60);
    client.set_recycling_goal(&recycler, &5_000u128, &target_date, &None);

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 5000);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Recycled);

    let participants = client.get_participants_meeting_goals();
    assert_eq!(participants.len(), 1);
}

#[test]
fn test_goal_zero_weight_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let target_date = env.ledger().timestamp() + (60 * 24 * 60 * 60);
    let result = client.try_set_recycling_goal(&recycler, &0u128, &target_date, &None);
    assert!(result.is_err());
}

// ========== Recycling Rate Tests ==========

#[test]
fn test_get_global_recycling_rate_50_percent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id1 = submit_waste(&client, &recycler, WasteType::Plastic, 10_000);
    let waste_id2 = submit_waste(&client, &recycler, WasteType::Metal, 10_000);

    // Advance waste_id1 to Recycled
    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Recycled);

    let rate = client.get_global_recycling_rate();
    assert_eq!(rate, 5000); // 50% = 5000 basis points
}

#[test]
fn test_get_participant_recycling_rate() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id1 = submit_waste(&client, &recycler, WasteType::Plastic, 10_000);
    let _waste_id2 = submit_waste(&client, &recycler, WasteType::Metal, 10_000);

    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Recycled);

    let rate = client.get_participant_recycling_rate(&recycler);
    assert_eq!(rate, 5000); // 50%
}

#[test]
fn test_recycling_rate_updates_on_status_change() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id = submit_waste(&client, &recycler, WasteType::Plastic, 10_000);

    let rate_before = client.get_participant_recycling_rate(&recycler);
    assert_eq!(rate_before, 0);

    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id, &recycler, &ProcessingStatus::Recycled);

    let rate_after = client.get_participant_recycling_rate(&recycler);
    assert_eq!(rate_after, 10_000); // 100%
}

#[test]
fn test_recycling_rate_zero_when_no_waste() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let rate = client.get_participant_recycling_rate(&recycler);
    assert_eq!(rate, 0);
}

#[test]
fn test_recycling_rate_basis_points_75_percent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, recycler, _collector) = setup_contract(&env);

    let waste_id1 = submit_waste(&client, &recycler, WasteType::Plastic, 7_500);
    let _waste_id2 = submit_waste(&client, &recycler, WasteType::Metal, 2_500);

    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id1, &recycler, &ProcessingStatus::Recycled);

    let rate = client.get_participant_recycling_rate(&recycler);
    assert_eq!(rate, 7500); // 75% = 7500 basis points
}
