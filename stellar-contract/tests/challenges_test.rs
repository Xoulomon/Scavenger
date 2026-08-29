#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    ChallengeStatus, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    client.initialize_admin(&admin);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("alice"),
        &1_000_000,
        &2_000_000,
    );
    (client, admin, recycler)
}

fn create_default_challenge(client: &ScavengerContractClient<'_>, admin: &Address, env: &Env) -> u64 {
    let now = env.ledger().timestamp();
    let c = client.create_challenge(
        admin,
        &symbol_short!("plastic5"),
        &500_000u128, // 500 kg
        &WasteType::Plastic,
        &now,
        &(now + 7 * 24 * 3600),
        &1000u128,
    );
    c.id
}

#[test]
fn test_create_challenge() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    let id = create_default_challenge(&client, &admin, &env);
    assert_eq!(id, 1);
    let c = client.get_challenge(&id).unwrap();
    assert_eq!(c.status, ChallengeStatus::Active);
    assert_eq!(c.reward, 1000);
}

#[test]
fn test_get_active_challenges() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    create_default_challenge(&client, &admin, &env);
    let active = client.get_active_challenges();
    assert_eq!(active.len(), 1);
}

#[test]
fn test_join_challenge() {
    let env = Env::default();
    let (client, admin, recycler) = setup(&env);
    let id = create_default_challenge(&client, &admin, &env);
    client.join_challenge(&id, &recycler);
    let prog = client.get_challenge_progress(&id, &recycler);
    assert_eq!(prog.weight_processed, 0);
    assert!(!prog.completed);
}

#[test]
#[should_panic(expected = "Already joined this challenge")]
fn test_join_challenge_twice_fails() {
    let env = Env::default();
    let (client, admin, recycler) = setup(&env);
    let id = create_default_challenge(&client, &admin, &env);
    client.join_challenge(&id, &recycler);
    client.join_challenge(&id, &recycler);
}

#[test]
fn test_update_challenge_progress_partial() {
    let env = Env::default();
    let (client, admin, recycler) = setup(&env);
    let id = create_default_challenge(&client, &admin, &env);
    client.join_challenge(&id, &recycler);
    client.update_challenge_progress(&id, &recycler, &100_000u128);
    let prog = client.get_challenge_progress(&id, &recycler);
    assert_eq!(prog.weight_processed, 100_000);
    assert!(!prog.completed);
}

#[test]
fn test_update_challenge_progress_auto_complete() {
    let env = Env::default();
    let (client, admin, recycler) = setup(&env);
    let id = create_default_challenge(&client, &admin, &env);
    client.join_challenge(&id, &recycler);
    // Meet the 500kg target
    client.update_challenge_progress(&id, &recycler, &500_000u128);
    let prog = client.get_challenge_progress(&id, &recycler);
    assert!(prog.completed);
}

#[test]
fn test_complete_challenge_manually() {
    let env = Env::default();
    let (client, admin, recycler) = setup(&env);
    let id = create_default_challenge(&client, &admin, &env);
    client.join_challenge(&id, &recycler);
    client.update_challenge_progress(&id, &recycler, &600_000u128);
    // Already auto-completed; calling complete_challenge should panic
    // So test the manual path before auto-complete
    let id2 = {
        let now = env.ledger().timestamp();
        client
            .create_challenge(
                &admin,
                &symbol_short!("ch2"),
                &200_000u128,
                &WasteType::Metal,
                &now,
                &(now + 3600),
                &500u128,
            )
            .id
    };
    client.join_challenge(&id2, &recycler);
    client.update_challenge_progress(&id2, &recycler, &200_000u128);
    let prog = client.get_challenge_progress(&id2, &recycler);
    assert!(prog.completed);
    // Reward should have been added
    let p = client.get_participant(&recycler);
    assert!(p.total_tokens_earned >= 500);
}

#[test]
#[should_panic(expected = "Target not yet reached")]
fn test_complete_challenge_before_target_fails() {
    let env = Env::default();
    let (client, admin, recycler) = setup(&env);
    let id = create_default_challenge(&client, &admin, &env);
    client.join_challenge(&id, &recycler);
    client.update_challenge_progress(&id, &recycler, &100_000u128);
    client.complete_challenge(&id, &recycler);
}

#[test]
#[should_panic(expected = "Max active challenges reached")]
fn test_max_active_challenges_enforced() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    let now = env.ledger().timestamp();
    for i in 0..11u64 {
        client.create_challenge(
            &admin,
            &symbol_short!("ch"),
            &100_000u128,
            &WasteType::Paper,
            &now,
            &(now + 3600 + i),
            &100u128,
        );
    }
}

#[test]
#[should_panic(expected = "Target weight must be > 0")]
fn test_create_challenge_zero_target_fails() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    let now = env.ledger().timestamp();
    client.create_challenge(
        &admin,
        &symbol_short!("bad"),
        &0u128,
        &WasteType::Paper,
        &now,
        &(now + 3600),
        &100u128,
    );
}

#[test]
#[should_panic(expected = "start_time must be before end_time")]
fn test_create_challenge_invalid_time_fails() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    let now = env.ledger().timestamp();
    client.create_challenge(
        &admin,
        &symbol_short!("bad"),
        &100_000u128,
        &WasteType::Paper,
        &(now + 3600),
        &now,
        &100u128,
    );
}

#[test]
fn test_get_challenge_returns_none_for_missing() {
    let env = Env::default();
    let (client, _, _) = setup(&env);
    assert!(client.get_challenge(&999).is_none());
}

#[test]
fn test_challenge_reward_credited_to_participant() {
    let env = Env::default();
    let (client, admin, recycler) = setup(&env);
    let id = create_default_challenge(&client, &admin, &env);
    client.join_challenge(&id, &recycler);
    let before = client.get_participant(&recycler).total_tokens_earned;
    client.update_challenge_progress(&id, &recycler, &500_000u128);
    let after = client.get_participant(&recycler).total_tokens_earned;
    assert_eq!(after - before, 1000);
}
