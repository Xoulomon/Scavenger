#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, Vec};

mod transfer;
pub use transfer::WasteTransfer;

#[contract]
pub struct WasteTransferContract;

#[contractimpl]
impl WasteTransferContract {
    /// Record a new waste transfer
    pub fn record_transfer(
        env: Env,
        waste_id: u128,
        from: Address,
        to: Address,
        latitude: i128,
        longitude: i128,
        notes: Symbol,
    ) {
        from.require_auth();

        let timestamp = env.ledger().timestamp();
        
        let transfer = WasteTransfer {
            waste_id,
            from: from.clone(),
            to: to.clone(),
            timestamp,
            latitude,
            longitude,
            notes,
        };

        // Store transfer in a vector keyed by waste_id
        let key = (Symbol::new(&env, "transfers"), waste_id);
        let mut transfers: Vec<WasteTransfer> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));
        
        transfers.push_back(transfer);
        env.storage().persistent().set(&key, &transfers);
    }

    /// Get all transfers for a specific waste_id
    pub fn get_transfers(env: Env, waste_id: u128) -> Vec<WasteTransfer> {
        let key = (Symbol::new(&env, "transfers"), waste_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }

    /// Get the latest transfer for a waste_id
    pub fn get_latest_transfer(env: Env, waste_id: u128) -> Option<WasteTransfer> {
        let transfers = Self::get_transfers(env, waste_id);
        if transfers.is_empty() {
            None
        } else {
            transfers.get(transfers.len() - 1)
        }
    }
}

mod test;
