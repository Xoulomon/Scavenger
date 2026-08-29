#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup() -> (Env, ScavengerContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, client, admin)
}

fn register(client: &ScavengerContractClient, env: &Env, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &soroban_sdk::symbol_short!("user"), &0, &0);
    addr
}

fn create_waste(client: &ScavengerContractClient, _env: &Env, owner: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &5000u128, owner, &0i128, &0i128)
}

// ──────────────────────────────────────────────────────────────────────────
// TAGS BOUNDS TESTS
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_tag_max_length_20_accepted() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let tag_20 = String::from_str(&env, "abcdefghijklmnopqrst"); // exactly 20 chars
    let waste = client.add_waste_tag(&waste_id, &tag_20, &recycler);
    assert_eq!(waste.tags.len(), 1);
}

#[test]
#[should_panic(expected = "Tag exceeds maximum length of 20 characters")]
fn test_tag_exceeds_20_char_limit() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let tag_21 = String::from_str(&env, "abcdefghijklmnopqrstu"); // 21 chars
    client.add_waste_tag(&waste_id, &tag_21, &recycler);
}

#[test]
fn test_tag_max_count_10_accepted() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let tags = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    for t in &tags {
        client.add_waste_tag(&waste_id, &String::from_str(&env, t), &recycler);
    }
    let waste = client.get_waste(&waste_id).unwrap();
    assert_eq!(waste.tags.len(), 10);
}

#[test]
#[should_panic(expected = "Tag limit reached")]
fn test_tag_exceeds_10_count_limit() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let tags = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
    for t in &tags {
        client.add_waste_tag(&waste_id, &String::from_str(&env, t), &recycler);
    }
}

// ──────────────────────────────────────────────────────────────────────────
// CONTAMINATION REASON BOUNDS TESTS
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_contamination_reason_max_200_chars() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let reason_200 = String::from_str(
        &env,
        "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea",
    ); // exactly 200 chars
    let waste = client.mark_contaminated(&waste_id, &reason_200, &50u32, &recycler);
    assert!(waste.is_contaminated);
}

#[test]
#[should_panic(expected = "Reason exceeds 200 characters")]
fn test_contamination_reason_exceeds_200_chars() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let reason_201 = String::from_str(
        &env,
        "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex eaa",
    ); // 201 chars
    client.mark_contaminated(&waste_id, &reason_201, &50u32, &recycler);
}

// ──────────────────────────────────────────────────────────────────────────
// IPFS HASH BOUNDS TESTS
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_image_hash_valid_qm_prefix() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let hash = String::from_str(&env, "QmValidIPFSHashExample123456789");
    let waste = client.set_waste_image(&waste_id, &hash, &recycler);
    assert_eq!(waste.image_hash, Some(hash));
}

#[test]
fn test_image_hash_valid_bafy_prefix() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let hash = String::from_str(&env, "bafyValidIPFSHashExample123456789");
    let waste = client.set_waste_image(&waste_id, &hash, &recycler);
    assert_eq!(waste.image_hash, Some(hash));
}

#[test]
#[should_panic(expected = "Invalid IPFS hash")]
fn test_image_hash_invalid_prefix() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let hash = String::from_str(&env, "XxInvalidHashExample123456789");
    client.set_waste_image(&waste_id, &hash, &recycler);
}

#[test]
#[should_panic(expected = "Invalid IPFS hash")]
fn test_image_hash_too_short() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let hash = String::from_str(&env, "Qma"); // too short (3 chars)
    client.set_waste_image(&waste_id, &hash, &recycler);
}

#[test]
#[should_panic(expected = "Invalid IPFS hash")]
fn test_image_hash_too_long() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    // Create a string longer than 128 characters
    let long_hash = String::from_str(&env, "QmValidIPFSHashExampleThatIsWayTooLongForValidationAndExceedsThe128CharacterLimitByALotMakingItInvalidForStorageInTheContractSystemXXXXXXXXXXXXXXXXXXXXXXXXXX");
    client.set_waste_image(&waste_id, &long_hash, &recycler);
}

#[test]
fn test_document_hash_max_5_count() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    for i in 0..5 {
        let hash = String::from_str(&env, &format!("QmValidHash{:02}", i));
        client.add_waste_document(&waste_id, &hash, &recycler);
    }
    let waste = client.get_waste(&waste_id).unwrap();
    assert_eq!(waste.document_hashes.len(), 5);
}

#[test]
#[should_panic(expected = "Document hash limit reached")]
fn test_document_hash_exceeds_5_count() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    for i in 0..6 {
        let hash = String::from_str(&env, &format!("QmValidHash{:02}", i));
        client.add_waste_document(&waste_id, &hash, &recycler);
    }
}

// ──────────────────────────────────────────────────────────────────────────
// TRACKING CODE BOUNDS TESTS (optional - currently uses default)
// ──────────────────────────────────────────────────────────────────────────

#[test]
fn test_get_waste_by_tracking_code_found() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &env, &recycler);

    let code = String::from_str(&env, "WS-TRACK"); // default code
    let found = client.get_waste_by_tracking_code(&code);
    assert!(found.is_some());
}

#[test]
fn test_get_waste_by_tracking_code_not_found() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let _waste_id = create_waste(&client, &env, &recycler);

    let code = String::from_str(&env, "NONEXISTENT");
    let found = client.get_waste_by_tracking_code(&code);
    assert!(found.is_none());
}
