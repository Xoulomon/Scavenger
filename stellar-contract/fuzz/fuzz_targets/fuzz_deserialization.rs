#![no_main]

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{Address, Env, String as SorobanString, Symbol};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};
use std::panic::catch_unwind;

fuzz_target!(|data: &[u8]| {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let participant = Address::generate(&env);

    // Fuzz participant registration deserialization
    let role_val = data.get(0).copied().unwrap_or(0u8);
    let role = ParticipantRole::from_u32(role_val as u32).unwrap_or(ParticipantRole::Recycler);

    let name_bytes = if data.len() > 1 {
        &data[1..std::cmp::min(data.len(), 65)]
    } else {
        b"fuzz"
    };
    let name = Symbol::new(&env, std::str::from_utf8(name_bytes).unwrap_or("fuzz"));

    let lat = i128::from_le_bytes([
        data.get(0).copied().unwrap_or(0), data.get(1).copied().unwrap_or(0),
        data.get(2).copied().unwrap_or(0), data.get(3).copied().unwrap_or(0),
        data.get(4).copied().unwrap_or(0), data.get(5).copied().unwrap_or(0),
        data.get(6).copied().unwrap_or(0), data.get(7).copied().unwrap_or(0),
        data.get(8).copied().unwrap_or(0), data.get(9).copied().unwrap_or(0),
        data.get(10).copied().unwrap_or(0), data.get(11).copied().unwrap_or(0),
        data.get(12).copied().unwrap_or(0), data.get(13).copied().unwrap_or(0),
        data.get(14).copied().unwrap_or(0), data.get(15).copied().unwrap_or(0),
    ]);
    let lon = i128::from_le_bytes([
        data.get(16).copied().unwrap_or(0), data.get(17).copied().unwrap_or(0),
        data.get(18).copied().unwrap_or(0), data.get(19).copied().unwrap_or(0),
        data.get(20).copied().unwrap_or(0), data.get(21).copied().unwrap_or(0),
        data.get(22).copied().unwrap_or(0), data.get(23).copied().unwrap_or(0),
        data.get(24).copied().unwrap_or(0), data.get(25).copied().unwrap_or(0),
        data.get(26).copied().unwrap_or(0), data.get(27).copied().unwrap_or(0),
        data.get(28).copied().unwrap_or(0), data.get(29).copied().unwrap_or(0),
        data.get(30).copied().unwrap_or(0), data.get(31).copied().unwrap_or(0),
    ]);

    catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.register_participant(&participant, &role, &name, &lat, &lon);
    })).ok();

    // Fuzz waste submission deserialization
    let waste_type_val = data.get(32).copied().unwrap_or(0u8) % 7;
    let waste_type = WasteType::from_u32(waste_type_val as u32).unwrap();
    let weight = u64::from_le_bytes([
        data.get(33).copied().unwrap_or(0), data.get(34).copied().unwrap_or(0),
        data.get(35).copied().unwrap_or(0), data.get(36).copied().unwrap_or(0),
        data.get(37).copied().unwrap_or(0), data.get(38).copied().unwrap_or(0),
        data.get(39).copied().unwrap_or(0), data.get(40).copied().unwrap_or(0),
    ]);
    let desc_bytes = if data.len() > 41 { &data[41..std::cmp::min(data.len(), 65)] } else { b"fuzz" };
    let desc = SorobanString::from_str(&env, std::str::from_utf8(desc_bytes).unwrap_or("fuzz"));

    catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.submit_material(&waste_type, &weight, &participant, &desc);
    })).ok();

    // Fuzz transfer deserialization
    let waste_id = u128::from_le_bytes([
        data.get(42).copied().unwrap_or(0), data.get(43).copied().unwrap_or(0),
        data.get(44).copied().unwrap_or(0), data.get(45).copied().unwrap_or(0),
        data.get(46).copied().unwrap_or(0), data.get(47).copied().unwrap_or(0),
        data.get(48).copied().unwrap_or(0), data.get(49).copied().unwrap_or(0),
        data.get(50).copied().unwrap_or(0), data.get(51).copied().unwrap_or(0),
        data.get(52).copied().unwrap_or(0), data.get(53).copied().unwrap_or(0),
        data.get(54).copied().unwrap_or(0), data.get(55).copied().unwrap_or(0),
        data.get(56).copied().unwrap_or(0), data.get(57).copied().unwrap_or(0),
    ]);
    let to = Address::generate(&env);
    let note_bytes = if data.len() > 58 { &data[58..std::cmp::min(data.len(), 82)] } else { b"fuzz" };
    let note = SorobanString::from_str(&env, std::str::from_utf8(note_bytes).unwrap_or("fuzz"));

    catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.transfer_waste(&waste_id, &participant, &to, &note);
    })).ok();
});

fn setup(env: &Env) -> (ScavengerContractClient, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}
