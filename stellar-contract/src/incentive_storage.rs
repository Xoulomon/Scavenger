//! Incentive storage module — Issue #1102
//!
//! Consolidates all incentive-related storage operations into a single module,
//! mirroring the `participant_storage` pattern established in Issue #934 and
//! the `waste_storage` pattern from Issue #1101.
//!
//! # Boundary
//! This module owns **only** raw CRUD against Soroban persistent storage.
//! Business logic (reward calculation, scheduling, budget exhaustion) remains
//! in `incentive.rs`.  The `incentive_mgmt.rs` re-export module provides
//! domain-scoped type imports for callers.
//!
//! # Storage layout
//! | Key scheme                                | Value type        | Storage tier |
//! |-------------------------------------------|-------------------|--------------|
//! | `("INC_V1", incentive_id: u64)`           | `Incentive`       | Persistent   |
//! | `("INC_MFR", (manufacturer, waste_type))` | `Vec<u64>`        | Persistent   |
//! | `("INC_CNT",)`                            | `u64`             | Instance     |

use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::errors::Error;
use crate::types::{Incentive, WasteType};

// ── Storage key constants ────────────────────────────────────────────────────

/// Key prefix for `Incentive` records (persistent).
pub const INCENTIVE_KEY_PREFIX: &str = "INC_V1";
/// Key prefix for per-manufacturer incentive-ID index (persistent).
pub const INCENTIVE_MFR_PREFIX: &str = "INC_MFR";

// ── Incentive CRUD ───────────────────────────────────────────────────────────

/// Persists an `Incentive` record.
///
/// Overwrites any existing record for the same `incentive_id`.
pub fn write_incentive(env: &Env, incentive: &Incentive) {
    let key = incentive_key(env, incentive.id);
    env.storage().persistent().set(&key, incentive);
}

/// Reads an `Incentive` record by ID.
///
/// Returns `None` if no record exists.
pub fn read_incentive(env: &Env, incentive_id: u64) -> Option<Incentive> {
    let key = incentive_key(env, incentive_id);
    env.storage()
        .persistent()
        .get::<(Symbol, u64), Incentive>(&key)
}

/// Reads an `Incentive` record or returns [`Error::IncentiveNotFound`].
pub fn get_or_fail(env: &Env, incentive_id: u64) -> Result<Incentive, Error> {
    read_incentive(env, incentive_id).ok_or(Error::IncentiveNotFound)
}

/// Removes an `Incentive` record from storage.
///
/// Typically called when permanently deleting an exhausted or cancelled
/// incentive.  Most flows deactivate (set `active = false`) rather than
/// delete — this helper is provided for explicit cleanup paths.
pub fn delete_incentive(env: &Env, incentive_id: u64) {
    let key = incentive_key(env, incentive_id);
    env.storage().persistent().remove(&key);
}

// ── Per-manufacturer incentive-ID index ──────────────────────────────────────

/// Returns the list of incentive IDs created by `manufacturer` for `waste_type`.
pub fn get_manufacturer_incentive_ids(
    env: &Env,
    manufacturer: &Address,
    waste_type: WasteType,
) -> Vec<u64> {
    let key = mfr_key(env, manufacturer, waste_type);
    env.storage()
        .persistent()
        .get::<(Symbol, Address, u32), Vec<u64>>(&key)
        .unwrap_or_else(|| Vec::new(env))
}

/// Appends `incentive_id` to the manufacturer's index for `waste_type`.
///
/// No-op if the ID is already present.
pub fn add_incentive_to_manufacturer(
    env: &Env,
    manufacturer: &Address,
    waste_type: WasteType,
    incentive_id: u64,
) {
    let key = mfr_key(env, manufacturer, waste_type);
    let mut ids = env
        .storage()
        .persistent()
        .get::<(Symbol, Address, u32), Vec<u64>>(&key)
        .unwrap_or_else(|| Vec::new(env));
    if !ids.contains(&incentive_id) {
        ids.push_back(incentive_id);
        env.storage().persistent().set(&key, &ids);
    }
}

/// Removes `incentive_id` from the manufacturer's index for `waste_type`.
///
/// Used when an incentive is deactivated so queries do not surface stale IDs.
pub fn remove_incentive_from_manufacturer(
    env: &Env,
    manufacturer: &Address,
    waste_type: WasteType,
    incentive_id: u64,
) {
    let key = mfr_key(env, manufacturer, waste_type);
    if let Some(ids) = env
        .storage()
        .persistent()
        .get::<(Symbol, Address, u32), Vec<u64>>(&key)
    {
        let mut new_ids: Vec<u64> = Vec::new(env);
        for id in ids.iter() {
            if id != incentive_id {
                new_ids.push_back(id);
            }
        }
        env.storage().persistent().set(&key, &new_ids);
    }
}

// ── Private key constructors ─────────────────────────────────────────────────

fn incentive_key(env: &Env, incentive_id: u64) -> (Symbol, u64) {
    (Symbol::new(env, INCENTIVE_KEY_PREFIX), incentive_id)
}

/// Encodes `(manufacturer, waste_type)` into a compound storage key.
/// `WasteType` is cast to `u32` to keep the key tuple serializable.
fn mfr_key(env: &Env, manufacturer: &Address, waste_type: WasteType) -> (Symbol, Address, u32) {
    (
        Symbol::new(env, INCENTIVE_MFR_PREFIX),
        manufacturer.clone(),
        waste_type as u32,
    )
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};
    use crate::types::WasteType;

    fn make_incentive(env: &Env, id: u64, rewarder: &Address) -> Incentive {
        Incentive::new(
            id,
            rewarder.clone(),
            WasteType::Plastic,
            10,
            1_000,
            env.ledger().timestamp(),
            env,
        )
    }

    #[test]
    fn test_write_and_read_incentive() {
        let env = Env::default();
        let mfr = Address::generate(&env);
        let incentive = make_incentive(&env, 1, &mfr);

        write_incentive(&env, &incentive);
        let result = read_incentive(&env, 1);

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, 1);
    }

    #[test]
    fn test_read_nonexistent_incentive_returns_none() {
        let env = Env::default();
        assert!(read_incentive(&env, 999).is_none());
    }

    #[test]
    fn test_get_or_fail_missing_returns_error() {
        let env = Env::default();
        let result = get_or_fail(&env, 999);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::IncentiveNotFound));
    }

    #[test]
    fn test_delete_incentive_removes_record() {
        let env = Env::default();
        let mfr = Address::generate(&env);
        let incentive = make_incentive(&env, 2, &mfr);

        write_incentive(&env, &incentive);
        assert!(read_incentive(&env, 2).is_some());

        delete_incentive(&env, 2);
        assert!(read_incentive(&env, 2).is_none());
    }

    #[test]
    fn test_add_and_get_manufacturer_incentive_ids() {
        let env = Env::default();
        let mfr = Address::generate(&env);

        assert_eq!(
            get_manufacturer_incentive_ids(&env, &mfr, WasteType::Plastic).len(),
            0
        );

        add_incentive_to_manufacturer(&env, &mfr, WasteType::Plastic, 10);
        add_incentive_to_manufacturer(&env, &mfr, WasteType::Plastic, 20);

        let ids = get_manufacturer_incentive_ids(&env, &mfr, WasteType::Plastic);
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&10));
        assert!(ids.contains(&20));
    }

    #[test]
    fn test_add_duplicate_incentive_id_is_idempotent() {
        let env = Env::default();
        let mfr = Address::generate(&env);

        add_incentive_to_manufacturer(&env, &mfr, WasteType::Glass, 5);
        add_incentive_to_manufacturer(&env, &mfr, WasteType::Glass, 5); // duplicate

        assert_eq!(
            get_manufacturer_incentive_ids(&env, &mfr, WasteType::Glass).len(),
            1
        );
    }

    #[test]
    fn test_manufacturer_indices_are_waste_type_scoped() {
        let env = Env::default();
        let mfr = Address::generate(&env);

        add_incentive_to_manufacturer(&env, &mfr, WasteType::Plastic, 1);
        add_incentive_to_manufacturer(&env, &mfr, WasteType::Metal, 2);

        let plastic = get_manufacturer_incentive_ids(&env, &mfr, WasteType::Plastic);
        let metal = get_manufacturer_incentive_ids(&env, &mfr, WasteType::Metal);

        assert_eq!(plastic.len(), 1);
        assert!(plastic.contains(&1));
        assert_eq!(metal.len(), 1);
        assert!(metal.contains(&2));
    }

    #[test]
    fn test_remove_incentive_from_manufacturer() {
        let env = Env::default();
        let mfr = Address::generate(&env);

        add_incentive_to_manufacturer(&env, &mfr, WasteType::Paper, 1);
        add_incentive_to_manufacturer(&env, &mfr, WasteType::Paper, 2);
        remove_incentive_from_manufacturer(&env, &mfr, WasteType::Paper, 1);

        let ids = get_manufacturer_incentive_ids(&env, &mfr, WasteType::Paper);
        assert_eq!(ids.len(), 1);
        assert!(ids.contains(&2));
        assert!(!ids.contains(&1));
    }

    #[test]
    fn test_write_preserves_active_flag_on_update() {
        let env = Env::default();
        let mfr = Address::generate(&env);
        let mut incentive = make_incentive(&env, 3, &mfr);

        write_incentive(&env, &incentive);
        incentive.active = false;
        write_incentive(&env, &incentive);

        let stored = read_incentive(&env, 3).unwrap();
        assert!(!stored.active);
    }
}
