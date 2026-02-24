use soroban_sdk::{contracttype, Address, Env, Vec};
use crate::types::{Incentive, Material, ParticipantRole, RecyclingStats, WasteType};
use crate::Participant;

/// Type-safe storage key enum for all contract storage locations
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    // Entity storage
    Waste(u128),                    // Map: waste_id -> Material
    Participant(Address),           // Map: address -> Participant
    Incentive(u128),                // Map: incentive_id -> Incentive
    Stats(Address),                 // Map: address -> RecyclingStats
    
    // Relationship storage
    WasteTransferHistory(u128),     // Map: waste_id -> Vec<Transfer>
    ParticipantWastes(Address),     // Map: address -> Vec<u128>
    RewarderIncentives(Address),    // Map: manufacturer -> Vec<u128>
    GeneralIncentives(WasteType),   // Map: waste_type -> Vec<u128>
    
    // Counter storage
    WasteCounter,                   // Singleton: u128
    IncentiveCounter,               // Singleton: u128
    
    // Configuration storage
    Config,                         // Singleton: ContractConfig
}

/// Transfer record for waste transfer history
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Transfer {
    pub from: Address,
    pub to: Address,
    pub timestamp: u64,
}

/// Contract configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractConfig {
    pub admin: Address,
    pub min_waste_weight: u64,
    pub verification_required: bool,
}

// Waste storage helpers
pub fn get_waste(env: &Env, waste_id: u128) -> Option<Material> {
    env.storage().instance().get(&StorageKey::Waste(waste_id))
}

pub fn set_waste(env: &Env, waste_id: u128, material: &Material) {
    env.storage().instance().set(&StorageKey::Waste(waste_id), material);
}

pub fn has_waste(env: &Env, waste_id: u128) -> bool {
    env.storage().instance().has(&StorageKey::Waste(waste_id))
}

pub fn remove_waste(env: &Env, waste_id: u128) {
    env.storage().instance().remove(&StorageKey::Waste(waste_id));
}

// Participant storage helpers
pub fn get_participant(env: &Env, address: &Address) -> Option<Participant> {
    env.storage().instance().get(&StorageKey::Participant(address.clone()))
}

pub fn set_participant(env: &Env, address: &Address, participant: &Participant) {
    env.storage().instance().set(&StorageKey::Participant(address.clone()), participant);
}

pub fn has_participant(env: &Env, address: &Address) -> bool {
    env.storage().instance().has(&StorageKey::Participant(address.clone()))
}

// Incentive storage helpers
pub fn get_incentive(env: &Env, incentive_id: u128) -> Option<Incentive> {
    env.storage().instance().get(&StorageKey::Incentive(incentive_id))
}

pub fn set_incentive(env: &Env, incentive_id: u128, incentive: &Incentive) {
    env.storage().instance().set(&StorageKey::Incentive(incentive_id), incentive);
}

pub fn has_incentive(env: &Env, incentive_id: u128) -> bool {
    env.storage().instance().has(&StorageKey::Incentive(incentive_id))
}

// Stats storage helpers
pub fn get_stats(env: &Env, address: &Address) -> Option<RecyclingStats> {
    env.storage().instance().get(&StorageKey::Stats(address.clone()))
}

pub fn set_stats(env: &Env, address: &Address, stats: &RecyclingStats) {
    env.storage().instance().set(&StorageKey::Stats(address.clone()), stats);
}

// Counter helpers
pub fn get_waste_counter(env: &Env) -> u128 {
    env.storage().instance().get(&StorageKey::WasteCounter).unwrap_or(0)
}

pub fn increment_waste_counter(env: &Env) -> u128 {
    let count = get_waste_counter(env);
    let next_id = count + 1;
    env.storage().instance().set(&StorageKey::WasteCounter, &next_id);
    next_id
}

pub fn get_incentive_counter(env: &Env) -> u128 {
    env.storage().instance().get(&StorageKey::IncentiveCounter).unwrap_or(0)
}

pub fn increment_incentive_counter(env: &Env) -> u128 {
    let count = get_incentive_counter(env);
    let next_id = count + 1;
    env.storage().instance().set(&StorageKey::IncentiveCounter, &next_id);
    next_id
}

// Relationship storage helpers
pub fn get_participant_wastes(env: &Env, address: &Address) -> Vec<u128> {
    env.storage()
        .instance()
        .get(&StorageKey::ParticipantWastes(address.clone()))
        .unwrap_or(Vec::new(env))
}

pub fn add_participant_waste(env: &Env, address: &Address, waste_id: u128) {
    let mut wastes = get_participant_wastes(env, address);
    wastes.push_back(waste_id);
    env.storage()
        .instance()
        .set(&StorageKey::ParticipantWastes(address.clone()), &wastes);
}

pub fn get_rewarder_incentives(env: &Env, manufacturer: &Address) -> Vec<u128> {
    env.storage()
        .instance()
        .get(&StorageKey::RewarderIncentives(manufacturer.clone()))
        .unwrap_or(Vec::new(env))
}

pub fn add_rewarder_incentive(env: &Env, manufacturer: &Address, incentive_id: u128) {
    let mut incentives = get_rewarder_incentives(env, manufacturer);
    incentives.push_back(incentive_id);
    env.storage()
        .instance()
        .set(&StorageKey::RewarderIncentives(manufacturer.clone()), &incentives);
}

pub fn get_general_incentives(env: &Env, waste_type: WasteType) -> Vec<u128> {
    env.storage()
        .instance()
        .get(&StorageKey::GeneralIncentives(waste_type))
        .unwrap_or(Vec::new(env))
}

pub fn add_general_incentive(env: &Env, waste_type: WasteType, incentive_id: u128) {
    let mut incentives = get_general_incentives(env, waste_type);
    incentives.push_back(incentive_id);
    env.storage()
        .instance()
        .set(&StorageKey::GeneralIncentives(waste_type), &incentives);
}

pub fn get_waste_transfer_history(env: &Env, waste_id: u128) -> Vec<Transfer> {
    env.storage()
        .instance()
        .get(&StorageKey::WasteTransferHistory(waste_id))
        .unwrap_or(Vec::new(env))
}

pub fn add_waste_transfer(env: &Env, waste_id: u128, transfer: Transfer) {
    let mut history = get_waste_transfer_history(env, waste_id);
    history.push_back(transfer);
    env.storage()
        .instance()
        .set(&StorageKey::WasteTransferHistory(waste_id), &history);
}

// Configuration storage helpers
pub fn get_config(env: &Env) -> Option<ContractConfig> {
    env.storage().instance().get(&StorageKey::Config)
}

pub fn set_config(env: &Env, config: &ContractConfig) {
    env.storage().instance().set(&StorageKey::Config, config);
}
