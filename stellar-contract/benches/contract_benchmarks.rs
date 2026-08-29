use criterion::{black_box, criterion_group, criterion_main, Criterion};
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String as SorobanString};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

fn setup_with_participant(env: &Env) -> (ScavengerContractClient, Address, Address) {
    let (client, admin) = setup(env);
    let participant = Address::generate(env);
    client.register_participant(
        &participant,
        &ParticipantRole::Recycler,
        &symbol_short!("Bench"),
        &0i128,
        &0i128,
    );
    (client, admin, participant)
}

fn bench_registration(c: &mut Criterion) {
    let mut group = c.benchmark_group("registration");

    group.bench_function("register_recycler", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin) = setup(&env);
            let participant = Address::generate(&env);
            client.register_participant(
                &participant,
                &black_box(ParticipantRole::Recycler),
                &symbol_short!("Bench"),
                &black_box(0i128),
                &black_box(0i128),
            );
        })
    });

    group.bench_function("register_collector", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin) = setup(&env);
            let participant = Address::generate(&env);
            client.register_participant(
                &participant,
                &black_box(ParticipantRole::Collector),
                &symbol_short!("Bench"),
                &black_box(40_000_000i128),
                &black_box(-74_000_000i128),
            );
        })
    });

    group.bench_function("register_manufacturer", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin) = setup(&env);
            let participant = Address::generate(&env);
            client.register_participant(
                &participant,
                &black_box(ParticipantRole::Manufacturer),
                &symbol_short!("Bench"),
                &black_box(0i128),
                &black_box(0i128),
            );
        })
    });

    group.finish();
}

fn bench_waste_submission(c: &mut Criterion) {
    let mut group = c.benchmark_group("waste_submission");

    group.bench_function("submit_paper", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin, participant) = setup_with_participant(&env);
            let desc = SorobanString::from_str(&env, "bench");
            client.submit_material(&black_box(WasteType::Paper), &black_box(1000u64), &participant, &desc);
        })
    });

    group.bench_function("submit_metal", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin, participant) = setup_with_participant(&env);
            let desc = SorobanString::from_str(&env, "bench");
            client.submit_material(&black_box(WasteType::Metal), &black_box(5000u64), &participant, &desc);
        })
    });

    group.bench_function("submit_electronic", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin, participant) = setup_with_participant(&env);
            let desc = SorobanString::from_str(&env, "bench");
            client.submit_material(
                &black_box(WasteType::Electronic),
                &black_box(2000u64),
                &participant,
                &desc,
            );
        })
    });

    group.bench_function("submit_10_sequential", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin, participant) = setup_with_participant(&env);
            let desc = SorobanString::from_str(&env, "bench");
            for _ in 0..10 {
                client.submit_material(&WasteType::Plastic, &1000u64, &participant, &desc);
            }
        })
    });

    group.finish();
}

fn bench_waste_transfer(c: &mut Criterion) {
    let mut group = c.benchmark_group("waste_transfer");

    group.bench_function("transfer_waste", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin) = setup(&env);

            let recycler = Address::generate(&env);
            let collector = Address::generate(&env);
            client.register_participant(
                &recycler,
                &ParticipantRole::Recycler,
                &symbol_short!("From"),
                &0i128,
                &0i128,
            );
            client.register_participant(
                &collector,
                &ParticipantRole::Collector,
                &symbol_short!("To"),
                &0i128,
                &0i128,
            );
            let desc = SorobanString::from_str(&env, "bench");
            let material = client.submit_material(&WasteType::Paper, &1000u64, &recycler, &desc);
            let note = SorobanString::from_str(&env, "transfer");
            client.transfer_waste(&black_box(material.id), &recycler, &collector, &note);
        })
    });

    group.finish();
}

fn bench_queries(c: &mut Criterion) {
    let mut group = c.benchmark_group("queries");

    group.bench_function("get_participant_wastes_empty", |b| {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, participant) = setup_with_participant(&env);

        b.iter(|| {
            client.get_participant_wastes(&participant);
        })
    });

    group.bench_function("get_participant_wastes_with_10", |b| {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, participant) = setup_with_participant(&env);
        let desc = SorobanString::from_str(&env, "bench");
        for _ in 0..10 {
            client.submit_material(&WasteType::Paper, &1000u64, &participant, &desc);
        }

        b.iter(|| {
            client.get_participant_wastes(&participant);
        })
    });

    group.bench_function("get_metrics", |b| {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, participant) = setup_with_participant(&env);
        let desc = SorobanString::from_str(&env, "bench");
        for _ in 0..5 {
            client.submit_material(&WasteType::Metal, &2000u64, &participant, &desc);
        }

        b.iter(|| {
            client.get_metrics();
        })
    });

    group.bench_function("is_participant_registered", |b| {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, participant) = setup_with_participant(&env);

        b.iter(|| {
            client.is_participant_registered(&participant);
        })
    });

    group.finish();
}

fn bench_incentives(c: &mut Criterion) {
    let mut group = c.benchmark_group("incentives");

    group.bench_function("create_incentive", |b| {
        b.iter(|| {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _admin) = setup(&env);
            let manufacturer = Address::generate(&env);
            client.register_participant(
                &manufacturer,
                &ParticipantRole::Manufacturer,
                &symbol_short!("Mfr"),
                &0i128,
                &0i128,
            );
            client.create_incentive(
                &manufacturer,
                &black_box(WasteType::Paper),
                &black_box(10u64),
                &black_box(10000u64),
            );
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_registration,
    bench_waste_submission,
    bench_waste_transfer,
    bench_queries,
    bench_incentives,
);
criterion_main!(benches);
