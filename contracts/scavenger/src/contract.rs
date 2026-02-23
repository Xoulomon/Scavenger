use soroban_sdk::{contract, contractimpl, Address, Env};

use crate::storage::Storage;

#[contract]
pub struct ScavengerContract;

#[contractimpl]
impl ScavengerContract {
    /// Initialize the contract with admin and configuration
    pub fn __constructor(
        env: &Env,
        admin: Address,
        token_address: Address,
        charity_address: Address,
        collector_percentage: u32,
        owner_percentage: u32,
    ) {
        // Validate percentages
        assert!(
            collector_percentage + owner_percentage <= 100,
            "Total percentages cannot exceed 100"
        );

        // Set admin
        Storage::set_admin(env, &admin);

        // Set configuration
        Storage::set_token_address(env, &token_address);
        Storage::set_charity_address(env, &charity_address);
        Storage::set_collector_percentage(env, collector_percentage);
        Storage::set_owner_percentage(env, owner_percentage);
        Storage::set_total_earned(env, 0);
    }

    /// Get the current admin address
    pub fn get_admin(env: &Env) -> Address {
        Storage::get_admin(env).expect("Admin not set")
    }

    /// Get the scavenger token address
    pub fn get_token_address(env: &Env) -> Address {
        Storage::get_token_address(env).expect("Token address not set")
    }

    /// Get the charity contract address
    pub fn get_charity_address(env: &Env) -> Address {
        Storage::get_charity_address(env).expect("Charity address not set")
    }

    /// Get the collector percentage
    pub fn get_collector_percentage(env: &Env) -> u32 {
        Storage::get_collector_percentage(env).expect("Collector percentage not set")
    }

    /// Get the owner percentage
    pub fn get_owner_percentage(env: &Env) -> u32 {
        Storage::get_owner_percentage(env).expect("Owner percentage not set")
    }

    /// Get the total tokens earned
    pub fn get_total_earned(env: &Env) -> i128 {
        Storage::get_total_earned(env)
    }

    /// Update the token address (admin only)
    pub fn update_token_address(env: &Env, admin: Address, new_address: Address) {
        Self::require_admin(env, &admin);
        Storage::set_token_address(env, &new_address);
    }

    /// Update the charity address (admin only)
    pub fn update_charity_address(env: &Env, admin: Address, new_address: Address) {
        Self::require_admin(env, &admin);
        Storage::set_charity_address(env, &new_address);
    }

    /// Update the collector percentage (admin only)
    pub fn update_collector_percentage(env: &Env, admin: Address, new_percentage: u32) {
        Self::require_admin(env, &admin);
        
        let owner_pct = Storage::get_owner_percentage(env).expect("Owner percentage not set");
        assert!(
            new_percentage + owner_pct <= 100,
            "Total percentages cannot exceed 100"
        );
        
        Storage::set_collector_percentage(env, new_percentage);
    }

    /// Update the owner percentage (admin only)
    pub fn update_owner_percentage(env: &Env, admin: Address, new_percentage: u32) {
        Self::require_admin(env, &admin);
        
        let collector_pct = Storage::get_collector_percentage(env)
            .expect("Collector percentage not set");
        assert!(
            collector_pct + new_percentage <= 100,
            "Total percentages cannot exceed 100"
        );
        
        Storage::set_owner_percentage(env, new_percentage);
    }

    /// Update both percentages at once (admin only)
    pub fn update_percentages(
        env: &Env,
        admin: Address,
        collector_percentage: u32,
        owner_percentage: u32,
    ) {
        Self::require_admin(env, &admin);
        
        assert!(
            collector_percentage + owner_percentage <= 100,
            "Total percentages cannot exceed 100"
        );
        
        Storage::set_collector_percentage(env, collector_percentage);
        Storage::set_owner_percentage(env, owner_percentage);
    }

    /// Transfer admin rights to a new address (admin only)
    pub fn transfer_admin(env: &Env, current_admin: Address, new_admin: Address) {
        Self::require_admin(env, &current_admin);
        Storage::set_admin(env, &new_admin);
    }

    // Private helper function to require admin authentication
    fn require_admin(env: &Env, admin: &Address) {
        let stored_admin = Storage::get_admin(env).expect("Admin not set");
        assert!(
            stored_admin == *admin,
            "Only admin can perform this action"
        );
        admin.require_auth();
    }
}
