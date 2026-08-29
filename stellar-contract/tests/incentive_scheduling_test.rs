#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{Error, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    client.initialize_admin(&admin);

    let manufacturer = Address::generate(env);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("mfr"),
        &0,
        &0,
    );

    (client, admin, manufacturer)
}

fn create_incentive(client: &ScavengerContractClient, manufacturer: &Address) -> u64 {
    let incentive = client.create_incentive(manufacturer, &WasteType::Plastic, &10u64, &1000u64);
    incentive.id
}

// ── Happy-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_schedule_sets_starts_and_ends() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    let incentive = client
        .schedule_incentive(&id, &manufacturer, &Some(now + 100), &Some(now + 1000))
        .unwrap();

    assert_eq!(incentive.starts_at, Some(now + 100));
    assert_eq!(incentive.ends_at, Some(now + 1000));
}

#[test]
fn test_schedule_only_ends_at() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    let incentive = client
        .schedule_incentive(&id, &manufacturer, &None, &Some(now + 500))
        .unwrap();

    assert_eq!(incentive.starts_at, None);
    assert_eq!(incentive.ends_at, Some(now + 500));
}

#[test]
fn test_incentive_excluded_before_starts_at() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    // Schedule to start in the future
    client
        .schedule_incentive(&id, &manufacturer, &Some(now + 500), &Some(now + 1000))
        .unwrap();

    // Query at current time — incentive should not appear
    let active = client.get_active_incentives();
    assert!(!active.iter().any(|i| i.id == id));
}

#[test]
fn test_incentive_included_within_window() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    // Schedule window that includes now
    client
        .schedule_incentive(&id, &manufacturer, &Some(now - 100), &Some(now + 1000))
        .unwrap();

    let active = client.get_active_incentives();
    assert!(active.iter().any(|i| i.id == id));
}

#[test]
fn test_incentive_excluded_after_ends_at() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    // Schedule ends in the future so we can set it
    client
        .schedule_incentive(&id, &manufacturer, &None, &Some(now + 100))
        .unwrap();

    // Advance time past ends_at
    env.ledger().with_mut(|l| l.timestamp = now + 200);

    let active = client.get_active_incentives();
    assert!(!active.iter().any(|i| i.id == id));
}

#[test]
fn test_get_incentives_by_waste_type_respects_window() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    // Schedule to start in the future
    client
        .schedule_incentive(&id, &manufacturer, &Some(now + 500), &Some(now + 1000))
        .unwrap();

    let results = client.get_incentives_by_waste_type(&WasteType::Plastic);
    assert!(!results.iter().any(|i| i.id == id));

    // Advance into the window
    env.ledger().with_mut(|l| l.timestamp = now + 600);
    let results = client.get_incentives_by_waste_type(&WasteType::Plastic);
    assert!(results.iter().any(|i| i.id == id));
}

#[test]
fn test_no_schedule_incentive_always_visible() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let id = create_incentive(&client, &manufacturer);

    // No schedule set — should always appear
    let active = client.get_active_incentives();
    assert!(active.iter().any(|i| i.id == id));
}

// ── Error-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_schedule_not_creator() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let other_mfr = Address::generate(&env);
    client.register_participant(
        &other_mfr,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("mfr2"),
        &0,
        &0,
    );

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    let result = client.try_schedule_incentive(&id, &other_mfr, &None, &Some(now + 500));
    assert_eq!(result, Err(Ok(Error::NotCreator)));
}

#[test]
fn test_schedule_ends_in_past() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    // ends_at is at or before now
    let result = client.try_schedule_incentive(&id, &manufacturer, &None, &Some(now));
    assert_eq!(result, Err(Ok(Error::InvalidSchedule)));
}

#[test]
fn test_schedule_starts_after_ends() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    let id = create_incentive(&client, &manufacturer);

    let result = client.try_schedule_incentive(&id, &manufacturer, &Some(now + 1000), &Some(now + 500));
    assert_eq!(result, Err(Ok(Error::InvalidSchedule)));
}

#[test]
#[should_panic(expected = "Incentive not found")]
fn test_schedule_incentive_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, manufacturer) = setup(&env);

    let now = env.ledger().timestamp();
    client
        .schedule_incentive(&9999u64, &manufacturer, &None, &Some(now + 500))
        .unwrap();
}
