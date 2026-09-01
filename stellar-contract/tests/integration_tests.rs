// Integration Test Suite for Contract-Frontend Interaction
// Comprehensive tests covering all key interaction paths

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    Address, Env, IntoVal, Symbol, Vec,
};

use crate::{
    ScavengerContract, ScavengerContractClient, ParticipantRole, WasteType, ProcessingStatus,
    WasteGrade, CertificationLevel,
};

/// Test fixture for common setup
struct IntegrationTestFixture {
    env: Env,
    contract: ScavengerContractClient<'static>,
    admin: Address,
    recycler: Address,
    collector: Address,
    manufacturer: Address,
}

impl IntegrationTestFixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ScavengerContract);
        let contract = ScavengerContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let recycler = Address::generate(&env);
        let collector = Address::generate(&env);
        let manufacturer = Address::generate(&env);

        // Initialize contract
        contract.initialize_admin(&admin);

        // Register participants
        contract.register_participant(
            &recycler,
            &ParticipantRole::Recycler,
            &Symbol::new(&env, "Recycler1"),
            &40_000_000,
            &-74_000_000,
        );

        contract.register_participant(
            &collector,
            &ParticipantRole::Collector,
            &Symbol::new(&env, "Collector1"),
            &40_100_000,
            &-74_100_000,
        );

        contract.register_participant(
            &manufacturer,
            &ParticipantRole::Manufacturer,
            &Symbol::new(&env, "Mfr1"),
            &40_200_000,
            &-74_200_000,
        );

        Self {
            env,
            contract,
            admin,
            recycler,
            collector,
            manufacturer,
        }
    }
}

#[test]
fn test_complete_waste_lifecycle() {
    let fixture = IntegrationTestFixture::new();

    // 1. Recycler submits waste
    let waste_id = fixture.contract.recycle_waste(
        &WasteType::Plastic,
        &5000,
        &fixture.recycler,
        &40_000_000,
        &-74_000_000,
    );
    assert_eq!(waste_id, 1);

    // 2. Verify waste was created
    let waste = fixture.contract.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.waste_type, WasteType::Plastic);
    assert_eq!(waste.weight, 5000);
    assert_eq!(waste.current_owner, fixture.recycler);
    assert!(waste.is_active);

    // 3. Transfer to collector
    let transfer = fixture.contract.transfer_waste_v2(
        &waste_id,
        &fixture.recycler,
        &fixture.collector,
        &40_100_000,
        &-74_100_000,
    );
    assert!(transfer.is_ok());

    // 4. Verify ownership changed
    let waste = fixture.contract.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, fixture.collector);

    // 5. Update processing status
    let waste = fixture.contract.update_processing_status(
        &waste_id,
        &fixture.collector,
        &ProcessingStatus::Sorted,
    );
    assert_eq!(waste.processing_status, ProcessingStatus::Sorted);

    // 6. Transfer to manufacturer
    let transfer = fixture.contract.transfer_waste_v2(
        &waste_id,
        &fixture.collector,
        &fixture.manufacturer,
        &40_200_000,
        &-74_200_000,
    );
    assert!(transfer.is_ok());

    // 7. Verify final state
    let waste = fixture.contract.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, fixture.manufacturer);

    // 8. Check transfer history
    let history = fixture.contract.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 2); // Two transfers
}

#[test]
fn test_participant_registration_flow() {
    let fixture = IntegrationTestFixture::new();
    let new_participant = Address::generate(&fixture.env);

    // Register new participant
    let participant = fixture.contract.register_participant(
        &new_participant,
        &ParticipantRole::Recycler,
        &Symbol::new(&fixture.env, "NewUser"),
        &40_500_000,
        &-74_500_000,
    );

    // Verify registration
    assert!(participant.is_registered);
    assert_eq!(participant.role, ParticipantRole::Recycler);
    assert_eq!(participant.total_waste_processed, 0);
    assert_eq!(participant.total_tokens_earned, 0);
    assert_eq!(participant.certification, CertificationLevel::Beginner);

    // Verify participant can be retrieved
    let retrieved = fixture.contract.get_participant(&new_participant).unwrap();
    assert_eq!(retrieved.address, new_participant);
    assert!(retrieved.is_registered);
}

#[test]
fn test_batch_waste_transfer() {
    let fixture = IntegrationTestFixture::new();

    // Create multiple waste items
    let mut waste_ids = Vec::new(&fixture.env);
    for i in 0..3 {
        let id = fixture.contract.recycle_waste(
            &WasteType::Metal,
            &(1000 + i * 100),
            &fixture.recycler,
            &40_000_000,
            &-74_000_000,
        );
        waste_ids.push_back(id);
    }

    // Batch transfer all wastes
    let result = fixture.contract.batch_transfer_waste(
        &waste_ids,
        &fixture.collector,
        &40_100_000,
        &-74_100_000,
    );
    assert!(result.is_ok());

    let transfers = result.unwrap();
    assert_eq!(transfers.len(), 3);

    // Verify all wastes transferred
    for waste_id in waste_ids.iter() {
        let waste = fixture.contract.get_waste_v2(&waste_id).unwrap();
        assert_eq!(waste.current_owner, fixture.collector);
    }
}

#[test]
fn test_waste_confirmation_flow() {
    let fixture = IntegrationTestFixture::new();

    // Create waste
    let waste_id = fixture.contract.recycle_waste(
        &WasteType::Glass,
        &3000,
        &fixture.recycler,
        &40_000_000,
        &-74_000_000,
    );

    // Transfer to collector
    fixture.contract.transfer_waste_v2(
        &waste_id,
        &fixture.recycler,
        &fixture.collector,
        &40_100_000,
        &-74_100_000,
    ).unwrap();

    // Confirm waste details
    let waste = fixture.contract.confirm_waste_details(
        &waste_id,
        &fixture.collector,
    );
    assert!(waste.is_confirmed);

    // Verify confirmation
    let waste = fixture.contract.get_waste_v2(&waste_id).unwrap();
    assert!(waste.is_confirmed);
}

#[test]
fn test_waste_grading_system() {
    let fixture = IntegrationTestFixture::new();

    // Create waste
    let waste_id = fixture.contract.recycle_waste(
        &WasteType::Plastic,
        &2000,
        &fixture.recycler,
        &40_000_000,
        &-74_000_000,
    );

    // Transfer to collector for grading
    fixture.contract.transfer_waste_v2(
        &waste_id,
        &fixture.recycler,
        &fixture.collector,
        &40_100_000,
        &-74_100_000,
    ).unwrap();

    // Grade the waste
    let waste = fixture.contract.set_waste_grade(
        &waste_id,
        &WasteGrade::A,
        &fixture.collector,
    );
    assert_eq!(waste.grade, WasteGrade::A);

    // Verify grade history
    let history = fixture.contract.get_grade_history(&waste_id);
    assert_eq!(history.len(), 1);
}

#[test]
fn test_incentive_creation_and_query() {
    let fixture = IntegrationTestFixture::new();

    // Create incentive
    let incentive = fixture.contract.create_incentive(
        &fixture.manufacturer,
        &WasteType::Plastic,
        &100,  // reward points per kg
        &10000, // total budget
    );

    assert_eq!(incentive.waste_type, WasteType::Plastic);
    assert_eq!(incentive.reward_points, 100);
    assert_eq!(incentive.total_budget, 10000);
    assert!(incentive.active);

    // Query incentives by waste type
    let incentives = fixture.contract.get_incentives(&WasteType::Plastic);
    assert!(incentives.len() > 0);

    // Query incentives by manufacturer
    let mfr_incentives = fixture.contract.get_incentives_by_rewarder(&fixture.manufacturer);
    assert!(mfr_incentives.len() > 0);
}

#[test]
fn test_participant_stats_tracking() {
    let fixture = IntegrationTestFixture::new();

    // Submit multiple wastes
    for i in 0..5 {
        fixture.contract.recycle_waste(
            &WasteType::Paper,
            &(1000 + i * 100),
            &fixture.recycler,
            &40_000_000,
            &-74_000_000,
        );
    }

    // Get participant info
    let info = fixture.contract.get_participant_info(&fixture.recycler).unwrap();
    assert!(info.participant.total_waste_processed > 0);

    // Get stats
    let stats = fixture.contract.get_stats(&fixture.recycler).unwrap();
    assert_eq!(stats.total_submissions, 5);
}

#[test]
fn test_error_handling_invalid_transfer() {
    let fixture = IntegrationTestFixture::new();

    // Create waste
    let waste_id = fixture.contract.recycle_waste(
        &WasteType::Plastic,
        &5000,
        &fixture.recycler,
        &40_000_000,
        &-74_000_000,
    );

    // Try invalid transfer (recycler to recycler - same role)
    let another_recycler = Address::generate(&fixture.env);
    fixture.contract.register_participant(
        &another_recycler,
        &ParticipantRole::Recycler,
        &Symbol::new(&fixture.env, "Recycler2"),
        &40_300_000,
        &-74_300_000,
    );

    let result = fixture.contract.transfer_waste_v2(
        &waste_id,
        &fixture.recycler,
        &another_recycler,
        &40_300_000,
        &-74_300_000,
    );

    // Should fail because same role transfer
    assert!(result.is_err());
}

#[test]
fn test_waste_reservation_workflow() {
    let fixture = IntegrationTestFixture::new();

    // Create waste
    let waste_id = fixture.contract.recycle_waste(
        &WasteType::Metal,
        &4000,
        &fixture.recycler,
        &40_000_000,
        &-74_000_000,
    );

    // Reserve waste
    let result = fixture.contract.reserve_waste(
        &waste_id,
        &fixture.collector,
        &86400, // 24 hours
    );
    assert!(result.is_ok());

    let waste = result.unwrap();
    assert_eq!(waste.reserved_by, Some(fixture.collector.clone()));

    // Try to transfer while reserved (should fail if not reserved by recipient)
    let another_collector = Address::generate(&fixture.env);
    fixture.contract.register_participant(
        &another_collector,
        &ParticipantRole::Collector,
        &Symbol::new(&fixture.env, "Collector2"),
        &40_400_000,
        &-74_400_000,
    );

    let transfer_result = fixture.contract.transfer_waste_v2(
        &waste_id,
        &fixture.recycler,
        &another_collector,
        &40_400_000,
        &-74_400_000,
    );
    assert!(transfer_result.is_err());

    // Cancel reservation
    let cancel_result = fixture.contract.cancel_reservation(
        &waste_id,
        &fixture.collector,
    );
    assert!(cancel_result.is_ok());
}

#[test]
fn test_global_metrics() {
    let fixture = IntegrationTestFixture::new();

    // Create some waste
    for _ in 0..3 {
        fixture.contract.recycle_waste(
            &WasteType::Plastic,
            &1000,
            &fixture.recycler,
            &40_000_000,
            &-74_000_000,
        );
    }

    // Get global metrics
    let metrics = fixture.contract.get_metrics();
    assert!(metrics.total_wastes_count > 0);

    // Get supply chain stats
    let (total_wastes, total_weight, total_tokens) = fixture.contract.get_supply_chain_stats();
    assert_eq!(total_wastes, 3);
    assert!(total_weight > 0);
}

#[test]
fn test_leaderboard_queries() {
    let fixture = IntegrationTestFixture::new();

    // Create waste for different participants
    for i in 0..5 {
        fixture.contract.recycle_waste(
            &WasteType::Plastic,
            &(1000 + i * 100),
            &fixture.recycler,
            &40_000_000,
            &-74_000_000,
        );
    }

    // Get top recyclers
    let top_recyclers = fixture.contract.get_top_recyclers(&10);
    assert!(top_recyclers.len() > 0);

    // Get participant rank
    let rank = fixture.contract.get_participant_rank(
        &fixture.recycler,
        &Symbol::new(&fixture.env, "weight"),
    );
    assert!(rank > 0);
}

#[test]
fn test_contamination_marking() {
    let fixture = IntegrationTestFixture::new();

    // Create waste
    let waste_id = fixture.contract.recycle_waste(
        &WasteType::Plastic,
        &3000,
        &fixture.recycler,
        &40_000_000,
        &-74_000_000,
    );

    // Mark as contaminated
    let waste = fixture.contract.mark_contaminated(
        &waste_id,
        &fixture.recycler,
        &75, // 75% contamination
        &"Mixed with organic waste".into_val(&fixture.env),
    );

    assert!(waste.is_contaminated);
    assert_eq!(waste.contamination_level, 75);

    // Get contaminated wastes list
    let contaminated = fixture.contract.get_contaminated_wastes();
    assert!(contaminated.contains(&waste_id));
}

#[test]
fn test_waste_split_merge() {
    let fixture = IntegrationTestFixture::new();

    // Create a large waste item
    let waste_id = fixture.contract.recycle_waste(
        &WasteType::Metal,
        &10000,
        &fixture.recycler,
        &40_000_000,
        &-74_000_000,
    );

    // Split into smaller pieces
    let mut weights = Vec::new(&fixture.env);
    weights.push_back(4000);
    weights.push_back(3000);
    weights.push_back(3000);

    let result = fixture.contract.split_waste(
        &waste_id,
        &fixture.recycler,
        &weights,
    );
    assert!(result.is_ok());

    let child_ids = result.unwrap();
    assert_eq!(child_ids.len(), 3);

    // Verify original is deactivated
    let original = fixture.contract.get_waste_v2(&waste_id).unwrap();
    assert!(!original.is_active);

    // Merge some back together
    let mut merge_ids = Vec::new(&fixture.env);
    merge_ids.push_back(child_ids.get(0).unwrap());
    merge_ids.push_back(child_ids.get(1).unwrap());

    let merge_result = fixture.contract.merge_wastes(
        &merge_ids,
        &fixture.recycler,
    );
    assert!(merge_result.is_ok());

    let merged_id = merge_result.unwrap();
    let merged = fixture.contract.get_waste_v2(&merged_id).unwrap();
    assert_eq!(merged.weight, 7000); // 4000 + 3000
}
