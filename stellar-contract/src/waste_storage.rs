//! Waste storage module — single owner of waste-related storage access.
//!
//! This module is the **only** place that reads or writes waste storage keys.
//! Business rules live in [`crate::waste`]; the contract entrypoints in
//! `lib.rs` call into this module for persistence.
//!
//! # Responsibilities
//! - Waste record CRUD (v2 `Waste` and legacy v1 `Material`)
//! - Waste ID counter
//! - Per-participant waste-ID index
//! - Per-waste transfer history
//! - Per-waste grading history and AI confidence
//!
//! # Storage layout
//! | Key scheme                          | Value type              | Tier       |
//! |-------------------------------------|-------------------------|------------|
//! | `("waste_v2", waste_id: u128)`      | `Waste`                 | Instance   |
//! | `("waste", waste_id: u64)`          | `Material`              | Instance   |
//! | `("waste_count",)`                  | `u64`                   | Instance   |
//! | `("participant_wastes", address)`   | `Vec<u128>`             | Instance   |
//! | `("transfer_history", waste_id)`    | `Vec<WasteTransfer>`    | Instance   |
//! | `("transfers", waste_id: u64)`      | `Vec<WasteTransfer>`    | Instance   |
//! | `("grade_history", waste_id)`       | `Vec<GradeRecord>`      | Instance   |
//! | `("ai_grade_conf", waste_id)`       | `u32`                   | Instance   |

use soroban_sdk::{Address, Env, Vec};

use crate::errors::Error;
use crate::storage_keys::{
    ai_grade_conf_key, grade_history_key, participant_waste_key, transfer_history_key, v1_transfer_history_key,
    waste_count_key, waste_key, waste_v2_key,
};
use crate::types::{GradeRecord, Material, Waste, WasteTransfer};

// ── Waste record CRUD (v2) ───────────────────────────────────────────────────

/// Persists a `Waste` record, overwriting any existing record for the same ID.
pub fn write_waste(env: &Env, waste: &Waste) {
    env.storage().instance().set(&waste_v2_key(waste.waste_id), waste);
}

/// Reads a `Waste` record by ID, returning `None` when it does not exist.
pub fn read_waste(env: &Env, waste_id: u128) -> Option<Waste> {
    env.storage().instance().get(&waste_v2_key(waste_id))
}

/// Reads a `Waste` record or returns [`Error::WasteNotFound`].
pub fn get_or_fail(env: &Env, waste_id: u128) -> Result<Waste, Error> {
    read_waste(env, waste_id).ok_or(Error::WasteNotFound)
}

/// Removes a `Waste` record from storage.
pub fn delete_waste(env: &Env, waste_id: u128) {
    env.storage().instance().remove(&waste_v2_key(waste_id));
}

// ── Waste record CRUD (legacy v1 Material) ──────────────────────────────────

/// Persists a legacy v1 `Material` record.
pub fn write_material(env: &Env, material: &Material) {
    env.storage().instance().set(&waste_key(material.id), material);
}

/// Reads a legacy v1 `Material` record by ID.
pub fn read_material(env: &Env, material_id: u64) -> Option<Material> {
    env.storage().instance().get(&waste_key(material_id))
}

// ── Waste ID counter ────────────────────────────────────────────────────────

/// Returns the last allocated waste ID (0 when no waste exists).
pub fn get_waste_count(env: &Env) -> u64 {
    env.storage().instance().get(&waste_count_key()).unwrap_or(0)
}

/// Persists the last allocated waste ID.
pub fn set_waste_count(env: &Env, value: u64) {
    env.storage().instance().set(&waste_count_key(), &value);
}

/// Allocates and persists the next waste ID.
pub fn next_waste_id(env: &Env) -> Result<u64, Error> {
    let next = get_waste_count(env).checked_add(1).ok_or(Error::Overflow)?;
    set_waste_count(env, next);
    Ok(next)
}

// ── Per-participant waste-ID index ──────────────────────────────────────────

/// Returns the waste IDs indexed for `owner` (empty when none).
pub fn get_participant_waste_ids(env: &Env, owner: &Address) -> Vec<u128> {
    env.storage()
        .instance()
        .get(&participant_waste_key(owner))
        .unwrap_or_else(|| Vec::new(env))
}

/// Replaces the participant's entire waste-ID index.
pub fn set_participant_waste_ids(env: &Env, owner: &Address, ids: &Vec<u128>) {
    env.storage().instance().set(&participant_waste_key(owner), ids);
}

/// Appends `waste_id` to the participant index (no-op if already present).
pub fn add_waste_to_participant(env: &Env, owner: &Address, waste_id: u128) {
    let mut ids = get_participant_waste_ids(env, owner);
    if !ids.contains(&waste_id) {
        ids.push_back(waste_id);
        set_participant_waste_ids(env, owner, &ids);
    }
}

/// Removes `waste_id` from the participant index if present.
pub fn remove_waste_from_participant(env: &Env, owner: &Address, waste_id: u128) {
    let ids = get_participant_waste_ids(env, owner);
    let mut kept = Vec::new(env);
    for id in ids.iter() {
        if id != waste_id {
            kept.push_back(id);
        }
    }
    set_participant_waste_ids(env, owner, &kept);
}

// ── Transfer history ────────────────────────────────────────────────────────

/// Returns the transfer history for a v2 waste item.
pub fn get_transfer_history(env: &Env, waste_id: u128) -> Vec<WasteTransfer> {
    env.storage()
        .instance()
        .get(&transfer_history_key(waste_id))
        .unwrap_or_else(|| Vec::new(env))
}

/// Replaces the transfer history for a v2 waste item.
pub fn set_transfer_history(env: &Env, waste_id: u128, history: &Vec<WasteTransfer>) {
    env.storage().instance().set(&transfer_history_key(waste_id), history);
}

/// Appends a transfer record to a v2 waste item's history.
pub fn append_transfer(env: &Env, waste_id: u128, record: &WasteTransfer) {
    let mut history = get_transfer_history(env, waste_id);
    history.push_back(record.clone());
    set_transfer_history(env, waste_id, &history);
}

/// Returns the legacy v1 transfer history for a `u64` waste ID.
pub fn get_v1_transfer_history(env: &Env, waste_id: u64) -> Vec<WasteTransfer> {
    env.storage()
        .instance()
        .get(&v1_transfer_history_key(waste_id))
        .unwrap_or_else(|| Vec::new(env))
}

/// Appends a transfer record to a legacy v1 waste item's history.
pub fn append_v1_transfer(env: &Env, waste_id: u64, record: &WasteTransfer) {
    let mut history = get_v1_transfer_history(env, waste_id);
    history.push_back(record.clone());
    env.storage()
        .instance()
        .set(&v1_transfer_history_key(waste_id), &history);
}

// ── Grading history ─────────────────────────────────────────────────────────

/// Returns the grading history for `waste_id`.
pub fn get_grade_history(env: &Env, waste_id: u128) -> Vec<GradeRecord> {
    env.storage()
        .instance()
        .get(&grade_history_key(waste_id))
        .unwrap_or_else(|| Vec::new(env))
}

/// Replaces the grading history for `waste_id`.
pub fn set_grade_history(env: &Env, waste_id: u128, history: &Vec<GradeRecord>) {
    env.storage().instance().set(&grade_history_key(waste_id), history);
}

/// Appends a grade record to `waste_id`'s history.
pub fn append_grade_record(env: &Env, waste_id: u128, record: &GradeRecord) {
    let mut history = get_grade_history(env, waste_id);
    history.push_back(record.clone());
    set_grade_history(env, waste_id, &history);
}

/// Persists the AI confidence score for `waste_id`.
pub fn set_ai_grade_confidence(env: &Env, waste_id: u128, confidence: u32) {
    env.storage().instance().set(&ai_grade_conf_key(waste_id), &confidence);
}

/// Reads the AI confidence score for `waste_id`.
pub fn get_ai_grade_confidence(env: &Env, waste_id: u128) -> Option<u32> {
    env.storage().instance().get(&ai_grade_conf_key(waste_id))
}

// ── Unit tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::WasteType;
    use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};

    fn make_waste(env: &Env, id: u128, owner: &Address) -> Waste {
        Waste::new(
            env,
            id,
            WasteType::Plastic,
            1_000,
            owner.clone(),
            0,
            0,
            env.ledger().timestamp(),
            true,
            false,
            owner.clone(),
            0,
        )
    }

    #[test]
    fn write_read_and_delete_waste() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let waste = make_waste(&env, 42, &owner);

        write_waste(&env, &waste);
        assert_eq!(read_waste(&env, 42), Some(waste));

        delete_waste(&env, 42);
        assert!(read_waste(&env, 42).is_none());
    }

    #[test]
    fn get_or_fail_returns_typed_error() {
        let env = Env::default();
        assert_eq!(get_or_fail(&env, 999), Err(Error::WasteNotFound));
    }

    #[test]
    fn next_waste_id_is_monotonic_and_overflow_safe() {
        let env = Env::default();
        assert_eq!(next_waste_id(&env), Ok(1));
        assert_eq!(next_waste_id(&env), Ok(2));
        assert_eq!(get_waste_count(&env), 2);

        set_waste_count(&env, u64::MAX);
        assert_eq!(next_waste_id(&env), Err(Error::Overflow));
        assert_eq!(get_waste_count(&env), u64::MAX);
    }

    #[test]
    fn participant_index_add_is_idempotent_and_remove_prunes() {
        let env = Env::default();
        let owner = Address::generate(&env);

        add_waste_to_participant(&env, &owner, 10);
        add_waste_to_participant(&env, &owner, 10);
        add_waste_to_participant(&env, &owner, 20);
        assert_eq!(get_participant_waste_ids(&env, &owner).len(), 2);

        remove_waste_from_participant(&env, &owner, 10);
        let ids = get_participant_waste_ids(&env, &owner);
        assert_eq!(ids.len(), 1);
        assert!(ids.contains(&20));
    }

    #[test]
    fn transfer_history_accumulates() {
        let env = Env::default();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let c = Address::generate(&env);

        let first = WasteTransfer::new(3, a, b.clone(), 1, 0, 0, symbol_short!("r1"));
        let second = WasteTransfer::new(3, b, c, 2, 0, 0, symbol_short!("r2"));

        append_transfer(&env, 3, &first);
        append_transfer(&env, 3, &second);

        let history = get_transfer_history(&env, 3);
        assert_eq!(history.len(), 2);
        assert_eq!(history.get(1), Some(second));
    }

    #[test]
    fn v1_material_round_trip() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let material = Material::new(
            7,
            WasteType::Paper,
            2_000,
            owner,
            0,
            soroban_sdk::String::from_str(&env, "paper"),
        );

        write_material(&env, &material);
        assert_eq!(read_material(&env, 7), Some(material));
        assert!(read_material(&env, 8).is_none());
    }
}
