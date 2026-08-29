#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, vec, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let verifier = Address::generate(env);
    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("rec"), &0, &0);
    client.register_participant(&verifier, &ParticipantRole::Recycler, &symbol_short!("ver"), &0, &0);
    let _ = admin;
    (client, admin, recycler, verifier)
}

fn desc(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

// ── batch_submit_materials ────────────────────────────────────────────────────

#[test]
fn test_batch_submit_basic() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let materials = vec![
        &env,
        (WasteType::Plastic, 2000u64, desc(&env, "bag")),
        (WasteType::Metal, 1500u64, desc(&env, "can")),
        (WasteType::Paper, 500u64, desc(&env, "box")),
    ];

    let results = client.batch_submit_materials(&materials, &recycler);

    assert_eq!(results.len(), 3);
    assert_eq!(results.get(0).unwrap().waste_type, WasteType::Plastic);
    assert_eq!(results.get(0).unwrap().weight, 2000);
    assert_eq!(results.get(1).unwrap().waste_type, WasteType::Metal);
    assert_eq!(results.get(2).unwrap().waste_type, WasteType::Paper);
}

#[test]
fn test_batch_submit_empty() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let materials = vec![&env];
    let results = client.batch_submit_materials(&materials, &recycler);

    assert_eq!(results.len(), 0);
}

#[test]
fn test_batch_submit_assigns_submitter() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let materials = vec![&env, (WasteType::Glass, 800u64, desc(&env, "bottles"))];
    let results = client.batch_submit_materials(&materials, &recycler);

    assert_eq!(results.get(0).unwrap().submitter, recycler);
}

#[test]
fn test_batch_submit_not_yet_verified() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let materials = vec![&env, (WasteType::Organic, 600u64, desc(&env, "compost"))];
    let results = client.batch_submit_materials(&materials, &recycler);

    assert!(!results.get(0).unwrap().verified);
}

#[test]
fn test_batch_submit_large_batch() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let mut materials = soroban_sdk::Vec::new(&env);
    for i in 0..10u64 {
        materials.push_back((WasteType::Plastic, 100u64 + i * 10, desc(&env, "item")));
    }

    let results = client.batch_submit_materials(&materials, &recycler);
    assert_eq!(results.len(), 10);
}

#[test]
fn test_batch_submit_updates_stats() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let materials = vec![
        &env,
        (WasteType::Plastic, 1000u64, desc(&env, "a")),
        (WasteType::Metal, 2000u64, desc(&env, "b")),
    ];

    client.batch_submit_materials(&materials, &recycler);

    let stats = client.get_stats(&recycler).unwrap();
    assert_eq!(stats.total_submissions, 2);
    assert_eq!(stats.total_weight, 3000);
}

#[test]
#[should_panic(expected = "registered participant")]
fn test_batch_submit_unregistered_submitter_panics() {
    let env = Env::default();
    let (client, _, _, _) = setup(&env);

    let unregistered = Address::generate(&env);
    let materials = vec![&env, (WasteType::Plastic, 500u64, desc(&env, "test"))];

    client.batch_submit_materials(&materials, &unregistered);
}

// ── batch_verify_materials ────────────────────────────────────────────────────

#[test]
fn test_batch_verify_basic() {
    let env = Env::default();
    let (client, _, recycler, verifier) = setup(&env);

    let materials = vec![
        &env,
        (WasteType::Plastic, 1000u64, desc(&env, "a")),
        (WasteType::Metal, 2000u64, desc(&env, "b")),
    ];
    let submitted = client.batch_submit_materials(&materials, &recycler);

    let ids = vec![&env, submitted.get(0).unwrap().id, submitted.get(1).unwrap().id];
    let verified = client.batch_verify_materials(&ids, &verifier);

    assert_eq!(verified.len(), 2);
    assert!(verified.get(0).unwrap().verified);
    assert!(verified.get(1).unwrap().verified);
}

#[test]
fn test_batch_verify_empty() {
    let env = Env::default();
    let (client, _, _, verifier) = setup(&env);

    let ids = vec![&env];
    let results = client.batch_verify_materials(&ids, &verifier);
    assert_eq!(results.len(), 0);
}

#[test]
fn test_batch_verify_skips_nonexistent_ids() {
    let env = Env::default();
    let (client, _, recycler, verifier) = setup(&env);

    let materials = vec![&env, (WasteType::Paper, 500u64, desc(&env, "doc"))];
    let submitted = client.batch_submit_materials(&materials, &recycler);
    let real_id = submitted.get(0).unwrap().id;

    // Mix a real ID with a nonexistent one — nonexistent are silently skipped
    let ids = vec![&env, real_id, 9999u64];
    let results = client.batch_verify_materials(&ids, &verifier);

    // Only the real one is returned
    assert_eq!(results.len(), 1);
    assert!(results.get(0).unwrap().verified);
}

#[test]
fn test_batch_verify_updates_stats() {
    let env = Env::default();
    let (client, _, recycler, verifier) = setup(&env);

    let materials = vec![
        &env,
        (WasteType::Electronic, 500u64, desc(&env, "phone")),
        (WasteType::Metal, 1000u64, desc(&env, "can")),
    ];
    let submitted = client.batch_submit_materials(&materials, &recycler);
    let ids = vec![&env, submitted.get(0).unwrap().id, submitted.get(1).unwrap().id];
    client.batch_verify_materials(&ids, &verifier);

    let stats = client.get_stats(&recycler).unwrap();
    assert_eq!(stats.verified_submissions, 2);
}

#[test]
#[should_panic(expected = "Verifier not registered")]
fn test_batch_verify_unregistered_verifier_panics() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let materials = vec![&env, (WasteType::Plastic, 1000u64, desc(&env, "test"))];
    let submitted = client.batch_submit_materials(&materials, &recycler);

    let unregistered = Address::generate(&env);
    let ids = vec![&env, submitted.get(0).unwrap().id];
    client.batch_verify_materials(&ids, &unregistered);
}

#[test]
#[should_panic(expected = "Only recyclers can verify materials")]
fn test_batch_verify_non_recycler_panics() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let collector = Address::generate(&env);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("col"), &0, &0);

    let materials = vec![&env, (WasteType::Plastic, 1000u64, desc(&env, "test"))];
    let submitted = client.batch_submit_materials(&materials, &recycler);

    let ids = vec![&env, submitted.get(0).unwrap().id];
    client.batch_verify_materials(&ids, &collector);
}

// ── submit_materials_batch (original name) ────────────────────────────────────

#[test]
fn test_submit_materials_batch_alias_works() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let materials = vec![&env, (WasteType::Glass, 750u64, desc(&env, "jar"))];
    let results = client.submit_materials_batch(&materials, &recycler);
    assert_eq!(results.len(), 1);
    assert_eq!(results.get(0).unwrap().waste_type, WasteType::Glass);
}

// ── verify_materials_batch (original name) ────────────────────────────────────

#[test]
fn test_verify_materials_batch_alias_works() {
    let env = Env::default();
    let (client, _, recycler, verifier) = setup(&env);

    let materials = vec![&env, (WasteType::Organic, 300u64, desc(&env, "food"))];
    let submitted = client.submit_materials_batch(&materials, &recycler);
    let ids = vec![&env, submitted.get(0).unwrap().id];
    let verified = client.verify_materials_batch(&ids, &verifier);
    assert!(verified.get(0).unwrap().verified);
}
