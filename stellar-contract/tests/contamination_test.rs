#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let name = symbol_short!("test");
    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);
    (client, admin, recycler, collector)
}

fn reason(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

// ── mark_contaminated ─────────────────────────────────────────────────────────

#[test]
fn test_mark_contaminated_sets_fields() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &5000, &recycler, &0, &0);
    let waste = client.mark_contaminated(&waste_id, &recycler, &30, &reason(&env, "mixed waste"));

    assert!(waste.is_contaminated);
    assert_eq!(waste.contamination_level, 30);
}

#[test]
fn test_mark_contaminated_full_level() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Metal, &2000, &recycler, &0, &0);
    let waste = client.mark_contaminated(&waste_id, &recycler, &100, &reason(&env, "fully contaminated"));

    assert!(waste.is_contaminated);
    assert_eq!(waste.contamination_level, 100);
}

#[test]
fn test_mark_contaminated_zero_level() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Glass, &1000, &recycler, &0, &0);
    let waste = client.mark_contaminated(&waste_id, &recycler, &0, &reason(&env, "clean"));

    assert!(waste.is_contaminated);
    assert_eq!(waste.contamination_level, 0);
}

#[test]
#[should_panic(expected = "Contamination level must be 0-100")]
fn test_mark_contaminated_level_over_100_panics() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.mark_contaminated(&waste_id, &recycler, &101, &reason(&env, "bad"));
}

#[test]
#[should_panic(expected = "Only recyclers can mark contamination")]
fn test_non_recycler_cannot_mark_contaminated() {
    let env = Env::default();
    let (client, _, _, collector) = setup(&env);

    let name = symbol_short!("test");
    let recycler2 = Address::generate(&env);
    client.register_participant(&recycler2, &ParticipantRole::Recycler, &name, &0, &0);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler2, &0, &0);

    client.mark_contaminated(&waste_id, &collector, &50, &reason(&env, "bad"));
}

#[test]
#[should_panic(expected = "Waste not found")]
fn test_mark_contaminated_nonexistent_waste_panics() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    client.mark_contaminated(&9999, &recycler, &10, &reason(&env, "ghost"));
}

// ── get_contaminated_wastes ───────────────────────────────────────────────────

#[test]
fn test_get_contaminated_wastes_empty_initially() {
    let env = Env::default();
    let (client, _, _, _) = setup(&env);
    assert_eq!(client.get_contaminated_wastes().len(), 0);
}

#[test]
fn test_get_contaminated_wastes_tracks_ids() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let id1 = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let id2 = client.recycle_waste(&WasteType::Metal, &2000, &recycler, &0, &0);

    client.mark_contaminated(&id1, &recycler, &60, &reason(&env, "dirty"));
    client.mark_contaminated(&id2, &recycler, &20, &reason(&env, "slightly dirty"));

    let list = client.get_contaminated_wastes();
    assert_eq!(list.len(), 2);
    assert!(list.contains(&id1));
    assert!(list.contains(&id2));
}

#[test]
fn test_mark_contaminated_twice_not_duplicated_in_list() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Paper, &1000, &recycler, &0, &0);
    client.mark_contaminated(&waste_id, &recycler, &10, &reason(&env, "first"));
    client.mark_contaminated(&waste_id, &recycler, &20, &reason(&env, "updated"));

    // ID should appear only once in the list
    let list = client.get_contaminated_wastes();
    let mut count = 0u32;
    for id in list.iter() {
        if id == waste_id {
            count += 1;
        }
    }
    assert_eq!(count, 1);
}

// ── waste state after marking ─────────────────────────────────────────────────

#[test]
fn test_get_waste_v2_reflects_contamination() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Organic, &3000, &recycler, &0, &0);
    client.mark_contaminated(&waste_id, &recycler, &75, &reason(&env, "food residue"));

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert!(waste.is_contaminated);
    assert_eq!(waste.contamination_level, 75);
}
