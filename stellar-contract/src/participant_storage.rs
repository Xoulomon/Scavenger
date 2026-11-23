//! Participant storage module - Issue #934
//!
//! Consolidates all participant-related storage operations into a single,
//! unified module to eliminate code duplication and improve maintainability.
//!
//! This module serves as the single source of truth for all participant
//! read/write operations, ensuring consistent storage patterns across the codebase.

use soroban_sdk::{Address, Env, Vec};

use crate::errors::Error;
use crate::types::{Participant, ParticipantInfo};

// Storage key prefixes for participant records are centralized in
// `crate::storage_keys` (issue #1738): `PARTICIPANT_REC` (value `"PART"`) for
// the per-participant record and `PART_INDEX` (value `"PART_IDX"`) for the
// address index. The previous local `&str` constants were removed in favor of
// those `Symbol` constants so the contract has a single source of truth for
// storage-key naming. Key *values* are unchanged (storage-compatible).

/// Stores a participant in persistent storage
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `participant`: The participant to store
pub fn write_participant(env: &Env, participant: &Participant) {
    let key = participant_key(env, &participant.address);
    env.storage().persistent().set(&key, participant);
}

/// Retrieves a participant from persistent storage
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address to retrieve
///
/// # Returns
/// `Some(Participant)` if found, `None` otherwise
pub fn read_participant(env: &Env, address: &Address) -> Option<Participant> {
    let key = participant_key(env, address);
    env.storage()
        .persistent()
        .get::<(soroban_sdk::Symbol, Address), Participant>(&key)
}

/// Checks if a participant address is registered
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address to check
///
/// # Returns
/// `true` if participant is registered, `false` otherwise
pub fn is_participant_registered(env: &Env, address: &Address) -> bool {
    match read_participant(env, address) {
        Some(p) => p.is_registered,
        None => false,
    }
}

/// Gets a participant or returns an error if not found/not registered
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address to retrieve
///
/// # Returns
/// `Ok(Participant)` if found and registered, `Err(Error::NotRegistered)` otherwise
pub fn get_or_fail(env: &Env, address: &Address) -> Result<Participant, Error> {
    read_participant(env, address)
        .filter(|p| p.is_registered)
        .ok_or(Error::NotRegistered)
}

/// Deletes a participant from persistent storage
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address to delete
#[cfg(test)]
pub fn delete_participant(env: &Env, address: &Address) {
    let key = participant_key(env, address);
    env.storage().persistent().remove(&key);
}

/// Updates participant statistics (waste processed and tokens earned)
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address
/// - `waste_weight`: Weight of waste to add to total
/// - `tokens_earned`: Tokens to add to total
pub fn update_participant_stats(
    env: &Env,
    address: &Address,
    waste_weight: u64,
    tokens_earned: u64,
) -> Result<(), Error> {
    let mut participant = get_or_fail(env, address)?;

    // Use checked arithmetic to prevent overflow
    participant.total_waste_processed = participant
        .total_waste_processed
        .checked_add(waste_weight as u128)
        .ok_or(Error::OverflowError)?;

    participant.total_tokens_earned = participant
        .total_tokens_earned
        .checked_add(tokens_earned as u128)
        .ok_or(Error::OverflowError)?;

    write_participant(env, &participant);
    Ok(())
}

/// Updates participant location coordinates
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address
/// - `latitude`: New latitude in microdegrees
/// - `longitude`: New longitude in microdegrees
pub fn update_participant_location(env: &Env, address: &Address, latitude: i128, longitude: i128) -> Result<(), Error> {
    let mut participant = get_or_fail(env, address)?;
    participant.latitude = latitude;
    participant.longitude = longitude;
    participant.last_active_at = env.ledger().timestamp();
    write_participant(env, &participant);
    Ok(())
}

/// Updates participant reputation score
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address
/// - `score_delta`: Change in reputation score (can be negative)
pub fn update_reputation_score(env: &Env, address: &Address, score_delta: i128) -> Result<(), Error> {
    let mut participant = get_or_fail(env, address)?;
    participant.reputation_score = participant
        .reputation_score
        .checked_add(score_delta)
        .ok_or(Error::OverflowError)?;
    participant.last_active_at = env.ledger().timestamp();
    write_participant(env, &participant);
    Ok(())
}

/// Updates participant last active timestamp
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address
pub fn update_last_active(env: &Env, address: &Address) -> Result<(), Error> {
    let mut participant = get_or_fail(env, address)?;
    participant.last_active_at = env.ledger().timestamp();
    write_participant(env, &participant);
    Ok(())
}

/// Adds a participant address to the global participant index
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address to add
fn add_to_participant_index(env: &Env, address: &Address) {
    let key = (crate::storage_keys::PART_INDEX,);
    let mut index: Vec<Address> = env
        .storage()
        .persistent()
        .get::<(soroban_sdk::Symbol,), Vec<Address>>(&key)
        .unwrap_or(Vec::new(env));

    // Avoid duplicates
    if !index.contains(address) {
        index.push_back(address.clone());
        env.storage().persistent().set(&key, &index);
    }
}

/// Removes a participant address from the global participant index
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `address`: The participant address to remove
fn remove_from_participant_index(env: &Env, address: &Address) {
    let key = (crate::storage_keys::PART_INDEX,);
    if let Some(mut index) = env
        .storage()
        .persistent()
        .get::<(soroban_sdk::Symbol,), Vec<Address>>(&key)
    {
        let mut new_index = Vec::new(env);
        for addr in index.iter() {
            if addr != *address {
                new_index.push_back(addr);
            }
        }
        env.storage().persistent().set(&key, &new_index);
    }
}

/// Gets the complete list of all participant addresses
///
/// # Parameters
/// - `env`: The Soroban environment
///
/// # Returns
/// `Vec<Address>` of all registered participant addresses
pub fn get_all_participants(env: &Env) -> Vec<Address> {
    let key = (crate::storage_keys::PART_INDEX,);
    env.storage()
        .persistent()
        .get::<(soroban_sdk::Symbol,), Vec<Address>>(&key)
        .unwrap_or(Vec::new(env))
}

/// Gets the count of registered participants
///
/// # Parameters
/// - `env`: The Soroban environment
///
/// # Returns
/// Count of participants
pub fn get_participant_count(env: &Env) -> u32 {
    get_all_participants(env).len()
}

/// Performs a batch update of participant statistics
///
/// This is more gas-efficient than updating participants individually
/// as it batches multiple operations together.
///
/// # Parameters
/// - `env`: The Soroban environment
/// - `updates`: Vector of (address, waste_weight, tokens_earned) tuples
#[cfg(test)]
pub fn batch_update_stats(env: &Env, updates: &Vec<(Address, u64, u64)>) -> Result<(), Error> {
    for (address, waste_weight, tokens_earned) in updates.iter() {
        update_participant_stats(env, address, *waste_weight, *tokens_earned)?;
    }
    Ok(())
}

/// Converts a participant to ParticipantInfo for public queries
///
/// # Parameters
/// - `participant`: The participant to convert
///
/// # Returns
/// `ParticipantInfo` containing public participant data
#[cfg(test)]
pub fn to_participant_info(participant: &Participant) -> ParticipantInfo {
    ParticipantInfo {
        address: participant.address.clone(),
        role: participant.role,
        name: participant.name.clone(),
        latitude: participant.latitude,
        longitude: participant.longitude,
        total_waste_processed: participant.total_waste_processed,
        total_tokens_earned: participant.total_tokens_earned,
        registered_at: participant.registered_at,
        reputation_score: participant.reputation_score,
        last_active_at: participant.last_active_at,
        certification: participant.certification,
        tier: participant.tier,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Constructs the persistent-storage key for a participant.
///
/// The prefix `Symbol` comes from [`crate::storage_keys::PARTICIPANT_REC`]
/// (value `"PART"`), centralized in issue #1738. The key value is unchanged.
fn participant_key(_env: &Env, address: &Address) -> (soroban_sdk::Symbol, Address) {
    (crate::storage_keys::PARTICIPANT_REC, address.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CertificationLevel, ParticipantRole, ParticipantTier};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{symbol_short, Address, Env};

    #[test]
    fn test_write_and_read_participant() {
        let env = Env::default();
        let address = Address::generate(&env);
        let participant = Participant {
            address: address.clone(),
            role: ParticipantRole::Recycler,
            name: symbol_short!("test"),
            latitude: 0,
            longitude: 0,
            is_registered: true,
            total_waste_processed: 100,
            total_tokens_earned: 50,
            registered_at: 1000,
            reputation_score: 10,
            last_active_at: 2000,
            certification: CertificationLevel::Beginner,
            tier: ParticipantTier::Bronze,
        };

        write_participant(&env, &participant);
        let read = read_participant(&env, &address);
        assert!(read.is_some());
        assert_eq!(read.unwrap().total_waste_processed, 100);
    }

    #[test]
    fn test_is_participant_registered() {
        let env = Env::default();
        let address = Address::generate(&env);
        assert!(!is_participant_registered(&env, &address));

        let participant = Participant {
            address: address.clone(),
            role: ParticipantRole::Recycler,
            name: symbol_short!("test"),
            latitude: 0,
            longitude: 0,
            is_registered: true,
            total_waste_processed: 0,
            total_tokens_earned: 0,
            registered_at: 1000,
            reputation_score: 0,
            last_active_at: 2000,
            certification: CertificationLevel::Beginner,
            tier: ParticipantTier::Bronze,
        };

        write_participant(&env, &participant);
        assert!(is_participant_registered(&env, &address));
    }

    #[test]
    fn test_update_participant_stats() {
        let env = Env::default();
        let address = Address::generate(&env);
        let participant = Participant {
            address: address.clone(),
            role: ParticipantRole::Recycler,
            name: symbol_short!("test"),
            latitude: 0,
            longitude: 0,
            is_registered: true,
            total_waste_processed: 100,
            total_tokens_earned: 50,
            registered_at: 1000,
            reputation_score: 0,
            last_active_at: 2000,
            certification: CertificationLevel::Beginner,
            tier: ParticipantTier::Bronze,
        };

        write_participant(&env, &participant);
        let result = update_participant_stats(&env, &address, 50, 25);
        assert!(result.is_ok());

        let updated = read_participant(&env, &address).unwrap();
        assert_eq!(updated.total_waste_processed, 150);
        assert_eq!(updated.total_tokens_earned, 75);
    }
}
