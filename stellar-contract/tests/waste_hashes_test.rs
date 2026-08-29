use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup() -> (Env, ScavengerContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, client, admin)
}

fn register_recycler(client: &ScavengerContractClient, env: &Env) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &ParticipantRole::Recycler, &Symbol::new(env, "r"), &0, &0);
    addr
}

fn recycle(client: &ScavengerContractClient, recycler: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &1000u128, recycler, &0i128, &0i128)
}

fn s(env: &Env, v: &str) -> String {
    String::from_str(env, v)
}

// ── 1. Set image hash (CIDv0 "Qm…") ─────────────────────────────────────────

#[test]
fn test_set_image_hash_qm() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);

    let waste = client.set_waste_image(
        &id,
        &s(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"),
        &recycler,
    );
    assert!(waste.image_hash.is_some());
}

// ── 2. Set image hash (CIDv1 "bafy…") ────────────────────────────────────────

#[test]
fn test_set_image_hash_bafy() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);

    let waste = client.set_waste_image(
        &id,
        &s(&env, "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"),
        &recycler,
    );
    assert!(waste.image_hash.is_some());
}

// ── 3. Invalid hash rejected ──────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Invalid IPFS hash")]
fn test_invalid_hash_rejected() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);
    client.set_waste_image(&id, &s(&env, "https://example.com/image.jpg"), &recycler);
}

// ── 4. Too-short hash rejected ────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Invalid IPFS hash")]
fn test_short_hash_rejected() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);
    client.set_waste_image(&id, &s(&env, "Qm"), &recycler);
}

// ── 5. Only owner can set image hash ─────────────────────────────────────────

#[test]
#[should_panic(expected = "Only the waste owner can set image hash")]
fn test_only_owner_can_set_image() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let other = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);
    client.set_waste_image(&id, &s(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"), &other);
}

// ── 6. Add document hash ──────────────────────────────────────────────────────

#[test]
fn test_add_document_hash() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);

    let waste = client.add_waste_document(
        &id,
        &s(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"),
        &recycler,
    );
    assert_eq!(waste.document_hashes.len(), 1);
}

// ── 7. Document hash limit of 5 enforced ─────────────────────────────────────

#[test]
#[should_panic(expected = "Document hash limit reached")]
fn test_document_hash_limit() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);
    let hash = s(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
    for _ in 0..6 {
        client.add_waste_document(&id, &hash, &recycler);
    }
}

// ── 8. Only owner can add document hash ──────────────────────────────────────

#[test]
#[should_panic(expected = "Only the waste owner can add document hashes")]
fn test_only_owner_can_add_document() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let other = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);
    client.add_waste_document(&id, &s(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"), &other);
}

// ── 9. Cannot set image on deactivated waste ──────────────────────────────────

#[test]
#[should_panic(expected = "Waste is deactivated")]
fn test_cannot_set_image_on_deactivated_waste() {
    let (env, client, admin) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);
    client.deactivate_waste(&id, &admin);
    client.set_waste_image(
        &id,
        &s(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"),
        &recycler,
    );
}

// ── 10. Cannot add document on deactivated waste ──────────────────────────────

#[test]
#[should_panic(expected = "Waste is deactivated")]
fn test_cannot_add_document_on_deactivated_waste() {
    let (env, client, admin) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);
    client.deactivate_waste(&id, &admin);
    client.add_waste_document(
        &id,
        &s(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"),
        &recycler,
    );
}

// ── 11. Image hash is replaced on second call ─────────────────────────────────

#[test]
fn test_image_hash_replaced() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);

    client.set_waste_image(
        &id,
        &s(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"),
        &recycler,
    );
    let hash2 = s(&env, "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
    let waste = client.set_waste_image(&id, &hash2.clone(), &recycler);
    assert_eq!(waste.image_hash.unwrap(), hash2);
}

// ── 12. New waste starts with no hashes ───────────────────────────────────────

#[test]
fn test_new_waste_has_no_hashes() {
    let (env, client, _) = setup();
    let recycler = register_recycler(&client, &env);
    let id = recycle(&client, &recycler);
    let waste = client.get_waste_v2(&id).unwrap();
    assert!(waste.image_hash.is_none());
    assert_eq!(waste.document_hashes.len(), 0);
}
