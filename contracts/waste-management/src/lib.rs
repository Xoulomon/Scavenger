#![no_std]

mod waste;

pub use waste::{Waste, WasteBuilder, WasteType};

use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct WasteManagement;

#[contractimpl]
impl WasteManagement {
    /// Create a new waste entry
    pub fn create_waste(
        env: Env,
        waste_id: u128,
        waste_type: WasteType,
        weight: u128,
        current_owner: Address,
        latitude: i128,
        longitude: i128,
    ) -> Waste {
        current_owner.require_auth();
        
        let waste = WasteBuilder::new()
            .waste_id(waste_id)
            .waste_type(waste_type)
            .weight(weight)
            .current_owner(current_owner.clone())
            .latitude(latitude)
            .longitude(longitude)
            .recycled_timestamp(env.ledger().timestamp())
            .is_active(true)
            .is_confirmed(false)
            .confirmer(current_owner)
            .build();
        
        waste
    }
}

#[cfg(test)]
mod test;
