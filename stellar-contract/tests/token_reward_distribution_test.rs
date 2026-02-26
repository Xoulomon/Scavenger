use soroban_sdk::{symbol_short, testutils::{Address as _, Events}, Address, Env, TryIntoVal};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_reward_calculation_paper() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    // Paper: 5kg * 1 multiplier * 10 = 50 points
    let material = client.submit_material(&WasteType::Paper, &5000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let participant = client.get_participant(&submitter).unwrap();
    assert!(participant.total_tokens_earned > 0);
}

#[test]
fn test_reward_calculation_metal() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    // Metal: 2kg * 5 multiplier * 10 = 100 points
    let material = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let participant = client.get_participant(&submitter).unwrap();
    assert_eq!(participant.total_tokens_earned, 100);
}

#[test]
fn test_reward_calculation_plastic() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    // Plastic: 3kg * 2 multiplier * 10 = 60 points
    let material = client.submit_material(&WasteType::Plastic, &3000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let participant = client.get_participant(&submitter).unwrap();
    assert_eq!(participant.total_tokens_earned, 60);
}

#[test]
fn test_distribution_to_owner_with_default_percentages() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    let material = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let participant = client.get_participant(&submitter).unwrap();
    // Default owner percentage is 50%, so 100 * 0.5 = 50, plus remainder = 100
    assert_eq!(participant.total_tokens_earned, 100);
}

#[test]
fn test_distribution_with_collector() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &10, &40);

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &500, &600);

    let material = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    // Transfer to collector
    client.transfer_waste(&material.id, &submitter, &collector, &soroban_sdk::String::from_str(&env, "transfer"));
    
    client.verify_material(&material.id, &recycler);

    let submitter_participant = client.get_participant(&submitter).unwrap();
    let collector_participant = client.get_participant(&collector).unwrap();

    // Note: After transfer, collector becomes the material owner (submitter field)
    // So collector gets owner_share + remainder
    // Total: 100 tokens
    // Collector gets: 10% (as collector) + 40% (as owner) + 50% (remainder) = 100
    // Original submitter gets: 0 (no longer owner)
    assert_eq!(collector_participant.total_tokens_earned, 100);
    assert_eq!(submitter_participant.total_tokens_earned, 0);
}

#[test]
fn test_percentage_calculations() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &15, &35);

    let collector_pct = client.get_collector_percentage().unwrap();
    let owner_pct = client.get_owner_percentage().unwrap();

    assert_eq!(collector_pct, 15);
    assert_eq!(owner_pct, 35);
}

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_invalid_percentage_sum_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &60, &50);
}

#[test]
fn test_recycler_gets_remainder() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &5, &30);

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    let material = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let participant = client.get_participant(&submitter).unwrap();
    
    // Total: 100 tokens
    // Collector: 5% = 5 (but no collector in chain)
    // Owner: 30% = 30
    // Remainder: 70
    // Submitter gets: 30 + 70 = 100
    assert_eq!(participant.total_tokens_earned, 100);
}

#[test]
fn test_chain_with_multiple_collectors() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    let collector1 = Address::generate(&env);
    let collector2 = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &10, &30);

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);
    client.register_participant(&collector1, &ParticipantRole::Collector, &symbol_short!("Col1"), &500, &600);
    client.register_participant(&collector2, &ParticipantRole::Collector, &symbol_short!("Col2"), &700, &800);

    let material = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.transfer_waste(&material.id, &submitter, &collector1, &soroban_sdk::String::from_str(&env, "t1"));
    client.transfer_waste(&material.id, &collector1, &collector2, &soroban_sdk::String::from_str(&env, "t2"));
    
    client.verify_material(&material.id, &recycler);

    let submitter_participant = client.get_participant(&submitter).unwrap();
    let collector1_participant = client.get_participant(&collector1).unwrap();
    let collector2_participant = client.get_participant(&collector2).unwrap();

    // After transfers, collector2 is the final owner
    // Total: 100 tokens
    // Each collector in chain: 10% = 10
    // Final owner (collector2): 10% (as collector) + 40% (as owner) + 40% (remainder) = 90
    assert_eq!(collector1_participant.total_tokens_earned, 10);
    assert_eq!(collector2_participant.total_tokens_earned, 90);
    assert_eq!(submitter_participant.total_tokens_earned, 0);
}

#[test]
fn test_short_chain_recycler_to_collector() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &20, &50);

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &500, &600);

    let material = client.submit_material(&WasteType::Paper, &10000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.transfer_waste(&material.id, &submitter, &collector, &soroban_sdk::String::from_str(&env, "transfer"));
    
    client.verify_material(&material.id, &recycler);

    let submitter_participant = client.get_participant(&submitter).unwrap();
    let collector_participant = client.get_participant(&collector).unwrap();

    // After transfer, collector is the final owner
    // Total: 100 tokens (10kg * 1 * 10)
    // Collector: 20% (as collector) + 50% (as owner) + 30% (remainder) = 100
    assert_eq!(collector_participant.total_tokens_earned, 100);
    assert_eq!(submitter_participant.total_tokens_earned, 0);
}

#[test]
fn test_long_chain_distribution() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    let collector1 = Address::generate(&env);
    let collector2 = Address::generate(&env);
    let collector3 = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &8, &40);

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);
    client.register_participant(&collector1, &ParticipantRole::Collector, &symbol_short!("C1"), &500, &600);
    client.register_participant(&collector2, &ParticipantRole::Collector, &symbol_short!("C2"), &700, &800);
    client.register_participant(&collector3, &ParticipantRole::Collector, &symbol_short!("C3"), &900, &1000);

    let material = client.submit_material(&WasteType::PetPlastic, &5000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.transfer_waste(&material.id, &submitter, &collector1, &soroban_sdk::String::from_str(&env, "t1"));
    client.transfer_waste(&material.id, &collector1, &collector2, &soroban_sdk::String::from_str(&env, "t2"));
    client.transfer_waste(&material.id, &collector2, &collector3, &soroban_sdk::String::from_str(&env, "t3"));
    
    client.verify_material(&material.id, &recycler);

    let submitter_participant = client.get_participant(&submitter).unwrap();
    let c1_participant = client.get_participant(&collector1).unwrap();
    let c2_participant = client.get_participant(&collector2).unwrap();
    let c3_participant = client.get_participant(&collector3).unwrap();

    // After transfers, collector3 is the final owner
    // Total: 150 tokens (5kg * 3 * 10)
    // Each collector in chain: 8% = 12
    // Final owner (collector3): 8% (as collector) + 40% (as owner) + 28% (remainder) = 114
    // c1 and c2 each get: 12
    assert_eq!(c1_participant.total_tokens_earned, 12);
    assert_eq!(c2_participant.total_tokens_earned, 12);
    assert_eq!(c3_participant.total_tokens_earned, 126); // 12 + 60 + 54
    assert_eq!(submitter_participant.total_tokens_earned, 0);
}

#[test]
fn test_statistics_update_after_verification() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    let participant_before = client.get_participant(&submitter).unwrap();
    assert_eq!(participant_before.total_tokens_earned, 0);

    let material = client.submit_material(&WasteType::Glass, &4000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let participant_after = client.get_participant(&submitter).unwrap();
    let stats_after = client.get_stats(&submitter).unwrap();
    
    assert!(participant_after.total_tokens_earned > 0);
    assert_eq!(stats_after.verified_submissions, 1);
}

#[test]
fn test_multiple_verifications_accumulate_tokens() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    let material1 = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test1"));
    let material2 = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test2"));
    
    client.verify_material(&material1.id, &recycler);
    client.verify_material(&material2.id, &recycler);

    let participant = client.get_participant(&submitter).unwrap();
    let stats = client.get_stats(&submitter).unwrap();
    
    assert_eq!(participant.total_tokens_earned, 200); // 100 + 100
    assert_eq!(stats.verified_submissions, 2);
}

#[test]
fn test_token_reward_event_emission() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    let material = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let events = env.events().all();
    
    // Find token reward events by checking for "rewarded" symbol
    let has_reward_event = events.iter().any(|e| {
        let topics = &e.1;
        if topics.len() > 0 {
            if let Ok(symbol) = <soroban_sdk::Val as TryIntoVal<Env, soroban_sdk::Symbol>>::try_into_val(&topics.get(0).unwrap(), &env) {
                return symbol == symbol_short!("rewarded");
            }
        }
        false
    });

    assert!(has_reward_event);
}

#[test]
fn test_participant_stats_update() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    let participant_before = client.get_participant(&submitter).unwrap();
    assert_eq!(participant_before.total_tokens_earned, 0);

    let material = client.submit_material(&WasteType::Plastic, &3000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let participant_after = client.get_participant(&submitter).unwrap();
    assert_eq!(participant_after.total_tokens_earned, 60);
}

#[test]
fn test_zero_weight_zero_reward() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    // Less than 1kg = 0 tokens
    let material = client.submit_material(&WasteType::Metal, &500, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.verify_material(&material.id, &recycler);

    let participant = client.get_participant(&submitter).unwrap();
    assert_eq!(participant.total_tokens_earned, 0);
}

#[test]
fn test_global_token_statistics() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter1 = Address::generate(&env);
    let submitter2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter1, &ParticipantRole::Recycler, &symbol_short!("S1"), &300, &400);
    client.register_participant(&submitter2, &ParticipantRole::Recycler, &symbol_short!("S2"), &500, &600);

    let material1 = client.submit_material(&WasteType::Metal, &2000, &submitter1, &soroban_sdk::String::from_str(&env, "test1"));
    let material2 = client.submit_material(&WasteType::Plastic, &3000, &submitter2, &soroban_sdk::String::from_str(&env, "test2"));
    
    client.verify_material(&material1.id, &recycler);
    client.verify_material(&material2.id, &recycler);

    let (_, _, total_tokens) = client.get_supply_chain_stats();
    
    assert_eq!(total_tokens, 160); // 100 + 60
}

#[test]
fn test_distribution_with_custom_percentages() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &25, &25);

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &500, &600);

    let material = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    
    client.transfer_waste(&material.id, &submitter, &collector, &soroban_sdk::String::from_str(&env, "transfer"));
    
    client.verify_material(&material.id, &recycler);

    let submitter_participant = client.get_participant(&submitter).unwrap();
    let collector_participant = client.get_participant(&collector).unwrap();

    // After transfer, collector is the final owner
    // Total: 100 tokens
    // Collector: 25% (as collector) + 25% (as owner) + 50% (remainder) = 100
    assert_eq!(collector_participant.total_tokens_earned, 100);
    assert_eq!(submitter_participant.total_tokens_earned, 0);
}
