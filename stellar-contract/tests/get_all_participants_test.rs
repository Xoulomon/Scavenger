#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient};

// ========== Basic Functionality Tests ==========

#[test]
fn test_get_all_participants_empty() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    // Get all participants when none are registered
    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 0);
}

#[test]
fn test_get_all_participants_single() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    // Register one participant
    client.register_participant(
        &user,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Get all participants
    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 1);
    assert_eq!(participants.get(0).unwrap(), user);
}

#[test]
fn test_get_all_participants_multiple() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    // Register multiple participants
    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user3"),
        &0,
        &0,
    );

    // Get all participants
    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 3);
    assert_eq!(participants.get(0).unwrap(), user1);
    assert_eq!(participants.get(1).unwrap(), user2);
    assert_eq!(participants.get(2).unwrap(), user3);
}

// ========== Pagination Tests ==========

#[test]
fn test_get_all_participants_pagination_first_page() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let mut users = vec![];
    for _i in 0..5 {
        let user = Address::generate(&env);
        client.register_participant(
            &user,
            &ParticipantRole::Collector,
            &soroban_sdk::symbol_short!("user"),
            &0,
            &0,
        );
        users.push(user);
    }

    // Get first page (offset 0, limit 2)
    let participants = client.get_all_participants(&0, &2);
    assert_eq!(participants.len(), 2);
    assert_eq!(participants.get(0).unwrap(), users[0]);
    assert_eq!(participants.get(1).unwrap(), users[1]);
}

#[test]
fn test_get_all_participants_pagination_second_page() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let mut users = vec![];
    for _i in 0..5 {
        let user = Address::generate(&env);
        client.register_participant(
            &user,
            &ParticipantRole::Collector,
            &soroban_sdk::symbol_short!("user"),
            &0,
            &0,
        );
        users.push(user);
    }

    // Get second page (offset 2, limit 2)
    let participants = client.get_all_participants(&2, &2);
    assert_eq!(participants.len(), 2);
    assert_eq!(participants.get(0).unwrap(), users[2]);
    assert_eq!(participants.get(1).unwrap(), users[3]);
}

#[test]
fn test_get_all_participants_pagination_last_page_partial() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let mut users = vec![];
    for _i in 0..5 {
        let user = Address::generate(&env);
        client.register_participant(
            &user,
            &ParticipantRole::Collector,
            &soroban_sdk::symbol_short!("user"),
            &0,
            &0,
        );
        users.push(user);
    }

    // Get last page (offset 4, limit 2) - should only return 1 item
    let participants = client.get_all_participants(&4, &2);
    assert_eq!(participants.len(), 1);
    assert_eq!(participants.get(0).unwrap(), users[4]);
}

#[test]
fn test_get_all_participants_pagination_limit_one() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );

    // Get with limit 1
    let participants = client.get_all_participants(&0, &1);
    assert_eq!(participants.len(), 1);
    assert_eq!(participants.get(0).unwrap(), user1);

    // Get next with limit 1
    let participants = client.get_all_participants(&1, &1);
    assert_eq!(participants.len(), 1);
    assert_eq!(participants.get(0).unwrap(), user2);
}

// ========== Edge Cases Tests ==========

#[test]
fn test_get_all_participants_offset_beyond_list() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.register_participant(
        &user,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Offset beyond list size
    let participants = client.get_all_participants(&10, &5);
    assert_eq!(participants.len(), 0);
}

#[test]
fn test_get_all_participants_offset_at_boundary() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );

    // Offset at exact list size
    let participants = client.get_all_participants(&2, &5);
    assert_eq!(participants.len(), 0);
}

#[test]
fn test_get_all_participants_zero_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.register_participant(
        &user,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Zero limit
    let participants = client.get_all_participants(&0, &0);
    assert_eq!(participants.len(), 0);
}

#[test]
fn test_get_all_participants_large_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );

    // Limit larger than list size
    let participants = client.get_all_participants(&0, &100);
    assert_eq!(participants.len(), 2);
}

// ========== Deregistration Tests ==========

#[test]
fn test_get_all_participants_after_deregistration() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    // Register three participants
    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user3"),
        &0,
        &0,
    );

    // Verify all three are in the list
    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 3);

    // Deregister middle participant
    client.deregister_participant(&user2);

    // Verify only two remain
    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 2);
    assert_eq!(participants.get(0).unwrap(), user1);
    assert_eq!(participants.get(1).unwrap(), user3);
}

#[test]
fn test_get_all_participants_deregister_first() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user3"),
        &0,
        &0,
    );

    // Deregister first participant
    client.deregister_participant(&user1);

    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 2);
    assert_eq!(participants.get(0).unwrap(), user2);
    assert_eq!(participants.get(1).unwrap(), user3);
}

#[test]
fn test_get_all_participants_deregister_last() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user3"),
        &0,
        &0,
    );

    // Deregister last participant
    client.deregister_participant(&user3);

    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 2);
    assert_eq!(participants.get(0).unwrap(), user1);
    assert_eq!(participants.get(1).unwrap(), user2);
}

#[test]
fn test_get_all_participants_deregister_all() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );

    // Deregister all
    client.deregister_participant(&user1);
    client.deregister_participant(&user2);

    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 0);
}

// ========== Order Preservation Tests ==========

#[test]
fn test_get_all_participants_preserves_registration_order() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let mut users = vec![];
    for _i in 0..10 {
        let user = Address::generate(&env);
        client.register_participant(
            &user,
            &ParticipantRole::Collector,
            &soroban_sdk::symbol_short!("user"),
            &0,
            &0,
        );
        users.push(user);
    }

    // Get all and verify order
    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 10);

    for (i, user) in users.iter().enumerate() {
        assert_eq!(participants.get(i as u32).unwrap(), *user);
    }
}

#[test]
fn test_get_all_participants_pagination_consistency() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let mut users = vec![];
    for _i in 0..10 {
        let user = Address::generate(&env);
        client.register_participant(
            &user,
            &ParticipantRole::Collector,
            &soroban_sdk::symbol_short!("user"),
            &0,
            &0,
        );
        users.push(user);
    }

    // Get in pages and verify consistency
    let page1 = client.get_all_participants(&0, &3);
    let page2 = client.get_all_participants(&3, &3);
    let page3 = client.get_all_participants(&6, &3);
    let page4 = client.get_all_participants(&9, &3);

    assert_eq!(page1.len(), 3);
    assert_eq!(page2.len(), 3);
    assert_eq!(page3.len(), 3);
    assert_eq!(page4.len(), 1);

    // Verify all pages together match the full list
    assert_eq!(page1.get(0).unwrap(), users[0]);
    assert_eq!(page1.get(1).unwrap(), users[1]);
    assert_eq!(page1.get(2).unwrap(), users[2]);
    assert_eq!(page2.get(0).unwrap(), users[3]);
    assert_eq!(page2.get(1).unwrap(), users[4]);
    assert_eq!(page2.get(2).unwrap(), users[5]);
    assert_eq!(page3.get(0).unwrap(), users[6]);
    assert_eq!(page3.get(1).unwrap(), users[7]);
    assert_eq!(page3.get(2).unwrap(), users[8]);
    assert_eq!(page4.get(0).unwrap(), users[9]);
}

// ========== Integration Tests ==========

#[test]
fn test_get_all_participants_with_different_roles() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);

    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("rec"),
        &0,
        &0,
    );
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("col"),
        &0,
        &0,
    );
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("mfr"),
        &0,
        &0,
    );

    let participants = client.get_all_participants(&0, &10);
    assert_eq!(participants.len(), 3);

    // Verify we can get participant details for each
    let p1 = client.get_participant(&participants.get(0).unwrap()).unwrap();
    let p2 = client.get_participant(&participants.get(1).unwrap()).unwrap();
    let p3 = client.get_participant(&participants.get(2).unwrap()).unwrap();

    assert_eq!(p1.role, ParticipantRole::Recycler);
    assert_eq!(p2.role, ParticipantRole::Collector);
    assert_eq!(p3.role, ParticipantRole::Manufacturer);
}

#[test]
fn test_get_all_participants_no_side_effects() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    client.register_participant(
        &user1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user1"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user2"),
        &0,
        &0,
    );

    // Call multiple times
    let result1 = client.get_all_participants(&0, &10);
    let result2 = client.get_all_participants(&0, &10);
    let result3 = client.get_all_participants(&0, &10);

    // All should be identical
    assert_eq!(result1.len(), result2.len());
    assert_eq!(result2.len(), result3.len());
    assert_eq!(result1.get(0).unwrap(), result2.get(0).unwrap());
    assert_eq!(result1.get(1).unwrap(), result2.get(1).unwrap());
}
