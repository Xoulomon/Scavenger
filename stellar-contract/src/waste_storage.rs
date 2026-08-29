//! Waste storage module — Issue #1101
//!
//! Consolidates all waste-related storage operations into a single module,
//! mirroring the `participant_storage` pattern established in Issue #934.
//!
//! # Boundary
//! This module owns **only** raw CRUD against Soroban persistent storage.
//! Business logic (state guards, route validation, weight checks) remains in
//! `waste.rs`.  The `waste_mgmt.rs` re-export module provides domain-scoped
//! type imports for callers.
//!
//! # Storage layout
//! | Key scheme                      | Value type       | Storage tier |
//! |---------------------------------|------------------|--------------|
//! | `("WASTE_V2", waste_id: u128)`  | `Waste`          | Persistent   |
//! | `("WPART", address)`            | `Vec<u128>`      | Persistent   |
//! | `("WXFR",  waste_id: u128)`     | `Vec<WasteTransfer>` | Persistent |
//! | `("WASTE_CNT",)`                | `u128`           | Instance     |

use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::errors::Error;
use crate::types::{Waste, WasteTransfer};

// ── Storage key constants ────────────────────────────────────────────────────

/// Key prefix for `Waste` records (persistent).
pub const WASTE_KEY_PREFIX: &str = "WASTE_V2";
/// Key prefix for per-participant waste-ID index (persistent).
pub const WASTE_PART_PREFIX: &str = "WPART";
/// Key prefix for per-waste transfer-history lists (persistent).
pub const WASTE_XFR_PREFIX: &str = "WXFR";

// ── Waste CRUD ───────────────────────────────────────────────────────────────

/// Persists a `Waste` record.
///
/// Overwrites any existing record for the same `waste_id`.
pub fn write_waste(env: &Env, waste: &Waste) {
    let key = waste_key(env, waste.waste_id);
    env.storage().persistent().set(&key, waste);
}

/// Reads a `Waste` record by ID.
///
/// Returns `None` if no record exists.
pub fn read_waste(env: &Env, waste_id: u128) -> Option<Waste> {
    let key = waste_key(env, waste_id);
    env.storage()
        .persistent()
        .get::<(Symbol, u128), Waste>(&key)
}

/// Reads a `Waste` record or returns [`Error::WasteNotFound`].
pub fn get_or_fail(env: &Env, waste_id: u128) -> Result<Waste, Error> {
    read_waste(env, waste_id).ok_or(Error::WasteNotFound)
}

/// Removes a `Waste` record from storage.
///
/// Used by deactivation flows where persistent deletion is preferred over
/// setting `is_active = false`.  Most deactivations keep the record and
/// only flip the flag — this helper is available for explicit cleanup.
pub fn delete_waste(env: &Env, waste_id: u128) {
    let key = waste_key(env, waste_id);
    env.storage().persistent().remove(&key);
}

// ── Per-participant waste-ID index ───────────────────────────────────────────

/// Returns the list of waste IDs owned (or previously owned) by `owner`.
pub fn get_participant_waste_ids(env: &Env, owner: &Address) -> Vec<u128> {
    let key = part_waste_key(env, owner);
    env.storage()
        .persistent()
        .get::<(Symbol, Address), Vec<u128>>(&key)
        .unwrap_or_else(|| Vec::new(env))
}

/// Appends `waste_id` to the participant's waste index (no-op if already present).
pub fn add_waste_to_participant(env: &Env, owner: &Address, waste_id: u128) {
    let key = part_waste_key(env, owner);
    let mut ids = env
        .storage()
        .persistent()
        .get::<(Symbol, Address), Vec<u128>>(&key)
        .unwrap_or_else(|| Vec::new(env));
    if !ids.contains(&waste_id) {
        ids.push_back(waste_id);
        env.storage().persistent().set(&key, &ids);
    }
}

/// Removes `waste_id` from the participant's waste index.
///
/// Used during ownership transfers so the outgoing owner's index is pruned.
pub fn remove_waste_from_participant(env: &Env, owner: &Address, waste_id: u128) {
    let key = part_waste_key(env, owner);
    if let Some(ids) = env
        .storage()
        .persistent()
        .get::<(Symbol, Address), Vec<u128>>(&key)
    {
        let mut new_ids: Vec<u128> = Vec::new(env);
        for id in ids.iter() {
            if id != waste_id {
                new_ids.push_back(id);
            }
        }
        env.storage().persistent().set(&key, &new_ids);
    }
}

// ── Transfer history ─────────────────────────────────────────────────────────

/// Returns the full transfer history for `waste_id`.
pub fn get_transfer_history(env: &Env, waste_id: u128) -> Vec<WasteTransfer> {
    let key = xfr_key(env, waste_id);
    env.storage()
        .persistent()
        .get::<(Symbol, u128), Vec<WasteTransfer>>(&key)
        .unwrap_or_else(|| Vec::new(env))
}

/// Appends a `WasteTransfer` record to `waste_id`'s history.
pub fn append_transfer(env: &Env, waste_id: u128, record: &WasteTransfer) {
    let key = xfr_key(env, waste_id);
    let mut history = env
        .storage()
        .persistent()
        .get::<(Symbol, u128), Vec<WasteTransfer>>(&key)
        .unwrap_or_else(|| Vec::new(env));
    history.push_back(record.clone());
    env.storage().persistent().set(&key, &history);
}

// ── Private key constructors ─────────────────────────────────────────────────

fn waste_key(env: &Env, waste_id: u128) -> (Symbol, u128) {
    (Symbol::new(env, WASTE_KEY_PREFIX), waste_id)
}

fn part_waste_key(env: &Env, owner: &Address) -> (Symbol, Address) {
    (Symbol::new(env, WASTE_PART_PREFIX), owner.clone())
}

fn xfr_key(env: &Env, waste_id: u128) -> (Symbol, u128) {
    (Symbol::new(env, WASTE_XFR_PREFIX), waste_id)
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
    use crate::types::{WasteType};

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
    fn test_write_and_read_waste() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let waste = make_waste(&env, 42, &owner);

        write_waste(&env, &waste);
        let result = read_waste(&env, 42);

        assert!(result.is_some());
        assert_eq!(result.unwrap().waste_id, 42);
    }

    #[test]
    fn test_read_nonexistent_waste_returns_none() {
        let env = Env::default();
        assert!(read_waste(&env, 999).is_none());
    }

    #[test]
    fn test_get_or_fail_missing_returns_error() {
        let env = Env::default();
        let result = get_or_fail(&env, 999);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::WasteNotFound));
    }

    #[test]
    fn test_delete_waste_removes_record() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let waste = make_waste(&env, 1, &owner);

        write_waste(&env, &waste);
        assert!(read_waste(&env, 1).is_some());

        delete_waste(&env, 1);
        assert!(read_waste(&env, 1).is_none());
    }

    #[test]
    fn test_add_and_get_participant_waste_ids() {
        let env = Env::default();
        let owner = Address::generate(&env);

        assert_eq!(get_participant_waste_ids(&env, &owner).len(), 0);

        add_waste_to_participant(&env, &owner, 10);
        add_waste_to_participant(&env, &owner, 20);

        let ids = get_participant_waste_ids(&env, &owner);
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&10));
        assert!(ids.contains(&20));
    }

    #[test]
    fn test_add_duplicate_waste_id_is_idempotent() {
        let env = Env::default();
        let owner = Address::generate(&env);

        add_waste_to_participant(&env, &owner, 5);
        add_waste_to_participant(&env, &owner, 5); // duplicate — must not grow

        assert_eq!(get_participant_waste_ids(&env, &owner).len(), 1);
    }

    #[test]
    fn test_remove_waste_from_participant() {
        let env = Env::default();
        let owner = Address::generate(&env);

        add_waste_to_participant(&env, &owner, 1);
        add_waste_to_participant(&env, &owner, 2);
        remove_waste_from_participant(&env, &owner, 1);

        let ids = get_participant_waste_ids(&env, &owner);
        assert_eq!(ids.len(), 1);
        assert!(ids.contains(&2));
        assert!(!ids.contains(&1));
    }

    #[test]
    fn test_append_and_get_transfer_history() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);

        assert_eq!(get_transfer_history(&env, 7).len(), 0);

        let record = WasteTransfer::new(
            7,
            from.clone(),
            to.clone(),
            1_000,
            10,
            20,
            symbol_short!("test"),
        );
        append_transfer(&env, 7, &record);

        let history = get_transfer_history(&env, 7);
        assert_eq!(history.len(), 1);
        assert_eq!(history.get(0).unwrap().from, from);
    }

    #[test]
    fn test_transfer_history_accumulates() {
        let env = Env::default();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let c = Address::generate(&env);

        let r1 = WasteTransfer::new(3, a.clone(), b.clone(), 1, 0, 0, symbol_short!("r1"));
        let r2 = WasteTransfer::new(3, b.clone(), c.clone(), 2, 0, 0, symbol_short!("r2"));

        append_transfer(&env, 3, &r1);
        append_transfer(&env, 3, &r2);

        let history = get_transfer_history(&env, 3);
        assert_eq!(history.len(), 2);
        assert_eq!(history.get(1).unwrap().from, b);
    }
}
