#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ReportPeriod, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let user1 = Address::generate(env);
    let user2 = Address::generate(env);

    client.initialize_admin(&admin);
    client.register_participant(&user1, &ParticipantRole::Recycler, &symbol_short!("user1"), &0, &0);
    client.register_participant(&user2, &ParticipantRole::Collector, &symbol_short!("user2"), &0, &0);

    (client, admin, user1, user2)
}

#[test]
fn test_compliance_reporting() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);

    let period = ReportPeriod {
        start_timestamp: 0,
        end_timestamp: 10000,
    };

    let report = client.generate_compliance_report(&admin, &period);
    assert_eq!(report.id, 1);
    assert_eq!(report.period.start_timestamp, 0);
    assert!(!report.is_finalized);

    client.finalize_compliance_report(&admin, &report.id);
    let finalized_report = client.get_compliance_report(&report.id);
    assert!(finalized_report.is_finalized);
}

#[test]
fn test_waste_substitution() {
    let env = Env::default();
    let (client, _, user1, _) = setup(&env);

    let original_id = client.recycle_waste(&WasteType::Plastic, &1000, &user1, &0, &0);
    let substitute_id = client.recycle_waste(&WasteType::Plastic, &1050, &user1, &0, &0);

    let reason = String::from_str(&env, "Original damaged");
    client.substitute_waste(&original_id, &substitute_id, &user1, &reason);

    let original = client.get_waste_v2(&original_id);
    let substitute = client.get_waste_v2(&substitute_id);

    assert!(!original.is_active);
    assert_eq!(original.substitution_history.len(), 1);
    assert_eq!(substitute.substitution_history.len(), 1);
}

#[test]
fn test_performance_benchmarking() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);

    client.record_performance_metric(&admin, &1000, &true);
    let stats = client.get_transaction_stats();
    assert_eq!(stats.total_transactions, 1);
    assert_eq!(stats.successful_transactions, 1);

    client.take_performance_snapshot(&admin, &10, &100, &50);
    let period_stats = client.analyze_performance_period(&0, &10000);
    assert_eq!(period_stats.total_transactions, 1);
}
