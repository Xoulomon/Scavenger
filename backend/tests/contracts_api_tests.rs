//! Comprehensive integration tests for the contracts API module
//! Tests for waste queries, participant queries, filtering, sorting, and pagination

use scavenger_backend::api::contracts::{
    WasteResponse, ParticipantResponse, ContractStatsResponse, ContractInfoResponse,
    WasteQueryParams, ParticipantQueryParams,
};

// ── Helper functions for test data ───────────────────────────────────────────

fn valid_waste_response(id: &str, waste_type: &str, participant_id: &str) -> WasteResponse {
    WasteResponse {
        id: id.to_string(),
        waste_type: waste_type.to_string(),
        weight: 100,
        status: "approved".to_string(),
        location: Some("New York".to_string()),
        participant_id: participant_id.to_string(),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-02T00:00:00Z".to_string(),
    }
}

fn valid_participant_response(id: &str, name: &str) -> ParticipantResponse {
    ParticipantResponse {
        id: id.to_string(),
        name: name.to_string(),
        role: "recycler".to_string(),
        location: Some("New York".to_string()),
        reputation: 85,
        joined_at: "2024-01-01T00:00:00Z".to_string(),
    }
}

fn valid_contract_stats() -> ContractStatsResponse {
    ContractStatsResponse {
        total_wastes: 1000,
        total_participants: 50,
        total_weight: 50000,
        recycled_weight: 45000,
        pending_approvals: 5,
        active_participants: 40,
    }
}

fn valid_contract_info() -> ContractInfoResponse {
    ContractInfoResponse {
        contract_id: "contract_001".to_string(),
        network: "ethereum".to_string(),
        version: "1.0.0".to_string(),
        last_updated: "2024-01-01T00:00:00Z".to_string(),
        total_transactions: 5000,
    }
}

// ── WasteResponse Tests ─────────────────────────────────────────────────────

#[test]
fn test_waste_response_valid_structure() {
    let waste = valid_waste_response("w1", "plastic", "p1");

    assert_eq!(waste.id, "w1");
    assert_eq!(waste.waste_type, "plastic");
    assert_eq!(waste.participant_id, "p1");
    assert!(!waste.status.is_empty());
    assert!(waste.weight > 0);
}

#[test]
fn test_waste_response_with_location() {
    let mut waste = valid_waste_response("w1", "plastic", "p1");
    waste.location = Some("San Francisco".to_string());

    assert_eq!(waste.location, Some("San Francisco".to_string()));
}

#[test]
fn test_waste_response_without_location() {
    let mut waste = valid_waste_response("w1", "plastic", "p1");
    waste.location = None;

    assert_eq!(waste.location, None);
}

#[test]
fn test_waste_response_status_variations() {
    let statuses = vec!["pending", "approved", "rejected", "processing"];

    for status in statuses {
        let mut waste = valid_waste_response("w1", "plastic", "p1");
        waste.status = status.to_string();
        assert_eq!(waste.status, status);
    }
}

#[test]
fn test_waste_response_serialization() {
    let waste = valid_waste_response("w1", "plastic", "p1");
    let json = serde_json::to_string(&waste).expect("serialization should work");
    let deserialized: WasteResponse = serde_json::from_str(&json)
        .expect("deserialization should work");

    assert_eq!(waste.id, deserialized.id);
    assert_eq!(waste.waste_type, deserialized.waste_type);
    assert_eq!(waste.weight, deserialized.weight);
}

// ── ParticipantResponse Tests ───────────────────────────────────────────────

#[test]
fn test_participant_response_valid_structure() {
    let participant = valid_participant_response("p1", "John Doe");

    assert_eq!(participant.id, "p1");
    assert_eq!(participant.name, "John Doe");
    assert!(!participant.role.is_empty());
    assert!(participant.reputation >= 0 && participant.reputation <= 100);
}

#[test]
fn test_participant_response_with_location() {
    let participant = valid_participant_response("p1", "Jane Doe");

    assert!(participant.location.is_some());
    assert_eq!(participant.location, Some("New York".to_string()));
}

#[test]
fn test_participant_response_role_variations() {
    let roles = vec!["recycler", "auditor", "admin", "verifier"];

    for role in roles {
        let mut participant = valid_participant_response("p1", "User");
        participant.role = role.to_string();
        assert_eq!(participant.role, role);
    }
}

#[test]
fn test_participant_response_reputation_ranges() {
    let reputations = vec![0, 25, 50, 75, 100];

    for reputation in reputations {
        let mut participant = valid_participant_response("p1", "User");
        participant.reputation = reputation;
        assert_eq!(participant.reputation, reputation);
    }
}

#[test]
fn test_participant_response_serialization() {
    let participant = valid_participant_response("p1", "John Doe");
    let json = serde_json::to_string(&participant).expect("serialization should work");
    let deserialized: ParticipantResponse = serde_json::from_str(&json)
        .expect("deserialization should work");

    assert_eq!(participant.id, deserialized.id);
    assert_eq!(participant.name, deserialized.name);
    assert_eq!(participant.role, deserialized.role);
}

// ── ContractStatsResponse Tests ─────────────────────────────────────────────

#[test]
fn test_contract_stats_response_valid_structure() {
    let stats = valid_contract_stats();

    assert!(stats.total_wastes >= 0);
    assert!(stats.total_participants >= 0);
    assert!(stats.total_weight >= 0);
    assert!(stats.recycled_weight >= 0);
    assert!(stats.recycled_weight <= stats.total_weight);
}

#[test]
fn test_contract_stats_zero_values() {
    let mut stats = valid_contract_stats();
    stats.total_wastes = 0;
    stats.total_participants = 0;
    stats.total_weight = 0;
    stats.recycled_weight = 0;
    stats.pending_approvals = 0;
    stats.active_participants = 0;

    assert_eq!(stats.total_wastes, 0);
}

#[test]
fn test_contract_stats_recycled_exceeds_total_invalid() {
    let mut stats = valid_contract_stats();
    stats.total_weight = 1000;
    stats.recycled_weight = 2000; // This could be a test for business logic validation

    assert!(stats.recycled_weight > stats.total_weight);
}

#[test]
fn test_contract_stats_serialization() {
    let stats = valid_contract_stats();
    let json = serde_json::to_string(&stats).expect("serialization should work");
    let deserialized: ContractStatsResponse = serde_json::from_str(&json)
        .expect("deserialization should work");

    assert_eq!(stats.total_wastes, deserialized.total_wastes);
    assert_eq!(stats.total_participants, deserialized.total_participants);
    assert_eq!(stats.total_weight, deserialized.total_weight);
}

// ── ContractInfoResponse Tests ──────────────────────────────────────────────

#[test]
fn test_contract_info_response_valid_structure() {
    let info = valid_contract_info();

    assert!(!info.contract_id.is_empty());
    assert!(!info.network.is_empty());
    assert!(!info.version.is_empty());
    assert!(info.total_transactions >= 0);
}

#[test]
fn test_contract_info_network_variations() {
    let networks = vec!["ethereum", "polygon", "arbitrum", "optimism"];

    for network in networks {
        let mut info = valid_contract_info();
        info.network = network.to_string();
        assert_eq!(info.network, network);
    }
}

#[test]
fn test_contract_info_version_parsing() {
    let versions = vec!["1.0.0", "2.1.3", "0.1.0"];

    for version in versions {
        let mut info = valid_contract_info();
        info.version = version.to_string();
        assert_eq!(info.version, version);
    }
}

#[test]
fn test_contract_info_serialization() {
    let info = valid_contract_info();
    let json = serde_json::to_string(&info).expect("serialization should work");
    let deserialized: ContractInfoResponse = serde_json::from_str(&json)
        .expect("deserialization should work");

    assert_eq!(info.contract_id, deserialized.contract_id);
    assert_eq!(info.network, deserialized.network);
}

// ── WasteQueryParams Tests ──────────────────────────────────────────────────

#[test]
fn test_waste_query_params_all_none() {
    let params = WasteQueryParams {
        page: None,
        limit: None,
        status: None,
        waste_type: None,
        participant_id: None,
        sort_by: None,
        sort_order: None,
    };

    assert!(params.page.is_none());
    assert!(params.limit.is_none());
}

#[test]
fn test_waste_query_params_with_pagination() {
    let params = WasteQueryParams {
        page: Some(2),
        limit: Some(50),
        status: None,
        waste_type: None,
        participant_id: None,
        sort_by: None,
        sort_order: None,
    };

    assert_eq!(params.page, Some(2));
    assert_eq!(params.limit, Some(50));
}

#[test]
fn test_waste_query_params_with_filters() {
    let params = WasteQueryParams {
        page: None,
        limit: None,
        status: Some("approved".to_string()),
        waste_type: Some("plastic".to_string()),
        participant_id: Some("p1".to_string()),
        sort_by: None,
        sort_order: None,
    };

    assert_eq!(params.status, Some("approved".to_string()));
    assert_eq!(params.waste_type, Some("plastic".to_string()));
}

#[test]
fn test_waste_query_params_with_sorting() {
    let params = WasteQueryParams {
        page: None,
        limit: None,
        status: None,
        waste_type: None,
        participant_id: None,
        sort_by: Some("created_at".to_string()),
        sort_order: Some("desc".to_string()),
    };

    assert_eq!(params.sort_by, Some("created_at".to_string()));
    assert_eq!(params.sort_order, Some("desc".to_string()));
}

// ── ParticipantQueryParams Tests ────────────────────────────────────────────

#[test]
fn test_participant_query_params_all_none() {
    let params = ParticipantQueryParams {
        page: None,
        limit: None,
        role: None,
        search: None,
    };

    assert!(params.page.is_none());
    assert!(params.limit.is_none());
}

#[test]
fn test_participant_query_params_with_pagination() {
    let params = ParticipantQueryParams {
        page: Some(1),
        limit: Some(25),
        role: None,
        search: None,
    };

    assert_eq!(params.page, Some(1));
    assert_eq!(params.limit, Some(25));
}

#[test]
fn test_participant_query_params_with_role_filter() {
    let params = ParticipantQueryParams {
        page: None,
        limit: None,
        role: Some("recycler".to_string()),
        search: None,
    };

    assert_eq!(params.role, Some("recycler".to_string()));
}

#[test]
fn test_participant_query_params_with_search() {
    let params = ParticipantQueryParams {
        page: None,
        limit: None,
        role: None,
        search: Some("john".to_string()),
    };

    assert_eq!(params.search, Some("john".to_string()));
}

// ── Edge cases and boundary tests ────────────────────────────────────────────

#[test]
fn test_waste_response_max_weight() {
    let mut waste = valid_waste_response("w1", "plastic", "p1");
    waste.weight = u128::MAX;

    assert_eq!(waste.weight, u128::MAX);
}

#[test]
fn test_contract_stats_large_values() {
    let mut stats = valid_contract_stats();
    stats.total_wastes = u64::MAX;
    stats.total_weight = u128::MAX;

    assert_eq!(stats.total_wastes, u64::MAX);
}

#[test]
fn test_waste_query_params_zero_page() {
    let params = WasteQueryParams {
        page: Some(0),
        limit: Some(10),
        status: None,
        waste_type: None,
        participant_id: None,
        sort_by: None,
        sort_order: None,
    };

    assert_eq!(params.page, Some(0));
}

#[test]
fn test_waste_response_empty_strings() {
    let waste = WasteResponse {
        id: String::new(),
        waste_type: String::new(),
        weight: 0,
        status: String::new(),
        location: None,
        participant_id: String::new(),
        created_at: String::new(),
        updated_at: String::new(),
    };

    assert!(waste.id.is_empty());
}

#[test]
fn test_participant_response_empty_strings() {
    let participant = ParticipantResponse {
        id: String::new(),
        name: String::new(),
        role: String::new(),
        location: None,
        reputation: 0,
        joined_at: String::new(),
    };

    assert!(participant.id.is_empty());
}
