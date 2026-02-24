use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

use crate::events;
use crate::storage::Storage;
use crate::types::{Incentive, Participant, Role, WasteType};

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

    /// Register a participant
    pub fn register_participant(
        env: &Env,
        address: Address,
        role: Role,
        name: soroban_sdk::String,
        latitude: i64,
        longitude: i64,
    ) -> Participant {
        address.require_auth();

        assert!(
            !Storage::is_participant_registered(env, &address),
            "Participant already registered"
        );

        let participant = Participant {
            address: address.clone(),
            role,
            name,
            latitude,
            longitude,
            registered_at: env.ledger().timestamp(),
        };

        Storage::set_participant(env, &address, &participant);
        participant
    }

    /// Get participant information
    pub fn get_participant(env: &Env, address: Address) -> Option<Participant> {
        Storage::get_participant(env, &address)
    }

    /// Check if participant is registered
    pub fn is_participant_registered(env: &Env, address: Address) -> bool {
        Storage::is_participant_registered(env, &address)
    }

    /// Create a new incentive (manufacturers only)
    pub fn create_incentive(
        env: &Env,
        rewarder: Address,
        waste_type: WasteType,
        reward_points: u64,
        total_budget: u64,
    ) -> Incentive {
        // Require authentication
        rewarder.require_auth();

        // Check caller is registered
        assert!(
            Storage::is_participant_registered(env, &rewarder),
            "Rewarder not registered"
        );

        // Get participant and verify role
        let participant = Storage::get_participant(env, &rewarder)
            .expect("Rewarder not found");

        assert!(
            participant.role.can_manufacture(),
            "Only manufacturers can create incentives"
        );

        // Generate incentive ID
        let incentive_id = Storage::next_incentive_id(env);

        // Create Incentive struct
        let incentive = Incentive::new(
            incentive_id,
            rewarder.clone(),
            waste_type,
            reward_points,
            total_budget,
            env.ledger().timestamp(),
        );

        // Store in all three incentive maps
        Storage::set_incentive(env, incentive_id, &incentive);
        Storage::add_incentive_to_rewarder(env, &rewarder, incentive_id);
        Storage::add_incentive_to_waste_type(env, waste_type, incentive_id);

        // Emit IncentiveSet event
        events::emit_incentive_set(
            env,
            incentive_id,
            &rewarder,
            waste_type,
            reward_points,
            total_budget,
        );

        incentive
    }

    /// Get incentive by ID
    pub fn get_incentive_by_id(env: &Env, incentive_id: u64) -> Option<Incentive> {
        Storage::get_incentive(env, incentive_id)
    }

    /// Check if incentive exists
    pub fn incentive_exists(env: &Env, incentive_id: u64) -> bool {
        Storage::incentive_exists(env, incentive_id)
    }

    /// Get all incentive IDs created by a specific rewarder (manufacturer)
    pub fn get_incentives_by_rewarder(env: &Env, rewarder: Address) -> Vec<u64> {
        Storage::get_incentives_by_rewarder(env, &rewarder)
    }

    /// Get all incentive IDs for a specific waste type
    pub fn get_incentives_by_waste_type(env: &Env, waste_type: WasteType) -> Vec<u64> {
        Storage::get_incentives_by_waste_type(env, waste_type)
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
