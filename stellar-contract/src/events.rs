use soroban_sdk::{symbol_short, Address, Env, Symbol};

use crate::types::{ParticipantRole, WasteType};

const WASTE_REGISTERED: Symbol = symbol_short!("recycled");
const DONATION_MADE: Symbol = symbol_short!("donated");
const WASTE_TRANSFERRED: Symbol = symbol_short!("transfer");
const WASTE_CONFIRMED: Symbol = symbol_short!("confirmed");
const PARTICIPANT_REGISTERED: Symbol = symbol_short!("reg");
const TOKENS_REWARDED: Symbol = symbol_short!("rewarded");

/// Emit event when waste is registered
pub fn emit_waste_registered(
    env: &Env,
    waste_id: u128,
    recycler: &Address,
    waste_type: WasteType,
    weight: u128,
    latitude: i128,
    longitude: i128,
) {
    env.events().publish(
        (WASTE_REGISTERED, waste_id),
        (waste_type, weight, recycler, latitude, longitude),
    );
}

/// Emit event when a donation is made to charity
pub fn emit_donation_made(
    env: &Env,
    donor: &Address,
    amount: i128,
    charity_contract: &Address,
) {
    env.events().publish(
        (DONATION_MADE, donor),
        (amount, charity_contract),
    );
}

/// Emit event when waste is transferred
pub fn emit_waste_transferred(
    env: &Env,
    waste_id: u64,
    from: &Address,
    to: &Address,
) {
    env.events().publish(
        (WASTE_TRANSFERRED, waste_id),
        (from, to),
    );
}

/// Emit event when waste is confirmed by a third party
pub fn emit_waste_confirmed(
    env: &Env,
    waste_id: u128,
    confirmer: &Address,
) {
    env.events().publish(
        (WASTE_CONFIRMED, waste_id),
        confirmer,
    );
}

/// Emit event when a participant registers
pub fn emit_participant_registered(
    env: &Env,
    address: &Address,
    role: &ParticipantRole,
    name: &Symbol,
    latitude: i128,
    longitude: i128,
) {
    env.events().publish(
        (PARTICIPANT_REGISTERED, address),
        (role, name, latitude, longitude),
    );
}

/// Emit event when tokens are rewarded
pub fn emit_tokens_rewarded(
    env: &Env,
    recipient: &Address,
    amount: u128,
    waste_id: u64,
) {
    env.events().publish(
        (TOKENS_REWARDED, recipient),
        (amount, waste_id),
    );
}
