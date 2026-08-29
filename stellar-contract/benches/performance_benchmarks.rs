use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String as SorobanString};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn main() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let participant = Address::generate(&env);
    client.register_participant(
        &participant,
        &ParticipantRole::Recycler,
        &symbol_short!("Perf"),
        &0i128,
        &0i128,
    );

    let start = std::time::Instant::now();
    for _ in 0..100 {
        let addr = Address::generate(&env);
        client.register_participant(&addr, &ParticipantRole::Recycler, &symbol_short!("Reg"), &0i128, &0i128);
    }
    println!("Participant Registration (100x): {:?}", start.elapsed());

    let desc = SorobanString::from_str(&env, "perf test");
    let start = std::time::Instant::now();
    for _ in 0..100 {
        client.submit_material(&WasteType::Paper, &1000u64, &participant, &desc);
    }
    println!("Waste Submission (100x): {:?}", start.elapsed());

    let start = std::time::Instant::now();
    for _ in 0..100 {
        let _ = client.get_participant_wastes(&participant);
    }
    println!("Get Participant Wastes (100x): {:?}", start.elapsed());

    let start = std::time::Instant::now();
    for _ in 0..100 {
        let _ = client.get_metrics();
    }
    println!("Get Metrics (100x): {:?}", start.elapsed());
}
