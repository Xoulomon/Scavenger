//! Test factory helpers for the Scavngr contract — closes #946.
//!
//! Tests were hand-building Participants, Wastes, Incentives and Transfers
//! inconsistently. This module provides typed factory functions so every test
//! can create objects in one line with sensible defaults.
//!
//! # Quick-start
//!
//! ```rust,ignore
//! mod factories;
//! use factories::*;
//!
//! #[test]
//! fn my_test() {
//!     let env = Env::default();
//!     env.mock_all_auths();
//!     let client = make_client(&env);
//!     let recycler  = ParticipantFactory::recycler(&env, &client);
//!     let waste_id  = WasteFactory::plastic(&env, &client, &recycler);
//!     let collector = ParticipantFactory::collector(&env, &client);
//!     TransferFactory::transfer(&client, waste_id, &recycler, &collector);
//! }
//! ```
//!
//! See `docs/FACTORY_HELPERS_GUIDE.md` for the full pattern catalogue.

#![cfg(test)]
#![allow(dead_code)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── Environment / client helpers ─────────────────────────────────────────────

/// Create a fresh contract client. Caller must already have called `env.mock_all_auths()`.
pub fn make_client_no_auth(env: &Env) -> ScavengerContractClient<'_> {
    let contract_id = env.register_contract(None, ScavengerContract);
    ScavengerContractClient::new(env, &contract_id)
}

/// Create a fresh contract client with `mock_all_auths` already enabled.
pub fn make_client(env: &Env) -> ScavengerContractClient<'_> {
    env.mock_all_auths();
    make_client_no_auth(env)
}

/// Full environment setup: client + admin + one participant of each role.
///
/// Returns `(client, admin, recycler, collector, manufacturer)`.
pub fn setup_full_env(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address, Address) {
    env.mock_all_auths();
    let client = make_client_no_auth(env);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    let recycler = ParticipantFactory::recycler(env, &client);
    let collector = ParticipantFactory::collector(env, &client);
    let manufacturer = ParticipantFactory::manufacturer(env, &client);
    (client, admin, recycler, collector, manufacturer)
}

// ── ParticipantFactory ────────────────────────────────────────────────────────

/// Factory for registered participants.
pub struct ParticipantFactory;

impl ParticipantFactory {
    /// Register and return a new Recycler address.
    pub fn recycler(env: &Env, client: &ScavengerContractClient<'_>) -> Address {
        Self::with_role(env, client, ParticipantRole::Recycler)
    }

    /// Register and return a new Collector address.
    pub fn collector(env: &Env, client: &ScavengerContractClient<'_>) -> Address {
        Self::with_role(env, client, ParticipantRole::Collector)
    }

    /// Register and return a new Manufacturer address.
    pub fn manufacturer(env: &Env, client: &ScavengerContractClient<'_>) -> Address {
        Self::with_role(env, client, ParticipantRole::Manufacturer)
    }

    /// Register a participant with the given role at (0, 0).
    pub fn with_role(env: &Env, client: &ScavengerContractClient<'_>, role: ParticipantRole) -> Address {
        let addr = Address::generate(env);
        let name = soroban_sdk::symbol_short!("test");
        client.register_participant(&addr, &role, &name, &0, &0);
        addr
    }

    /// Register a participant with a specific location.
    pub fn with_location(
        env: &Env,
        client: &ScavengerContractClient<'_>,
        role: ParticipantRole,
        lat: i32,
        lon: i32,
    ) -> Address {
        let addr = Address::generate(env);
        let name = soroban_sdk::symbol_short!("test");
        client.register_participant(&addr, &role, &name, &lat, &lon);
        addr
    }
}

// ── WasteFactory ─────────────────────────────────────────────────────────────

/// Factory for submitted waste items.
pub struct WasteFactory;

impl WasteFactory {
    /// Submit 1 000 g of Plastic waste and return the waste ID.
    pub fn plastic(_env: &Env, client: &ScavengerContractClient<'_>, owner: &Address) -> u128 {
        Self::with_type(_env, client, owner, WasteType::Plastic, 1_000)
    }

    /// Submit 1 000 g of Metal waste and return the waste ID.
    pub fn metal(_env: &Env, client: &ScavengerContractClient<'_>, owner: &Address) -> u128 {
        Self::with_type(_env, client, owner, WasteType::Metal, 1_000)
    }

    /// Submit 1 000 g of Glass waste and return the waste ID.
    pub fn glass(_env: &Env, client: &ScavengerContractClient<'_>, owner: &Address) -> u128 {
        Self::with_type(_env, client, owner, WasteType::Glass, 1_000)
    }

    /// Submit 1 000 g of Paper waste and return the waste ID.
    pub fn paper(_env: &Env, client: &ScavengerContractClient<'_>, owner: &Address) -> u128 {
        Self::with_type(_env, client, owner, WasteType::Paper, 1_000)
    }

    /// Submit 1 000 g of Electronics waste and return the waste ID.
    pub fn electronics(_env: &Env, client: &ScavengerContractClient<'_>, owner: &Address) -> u128 {
        Self::with_type(_env, client, owner, WasteType::Electronics, 1_000)
    }

    /// Submit waste with an explicit type and weight; returns the waste ID.
    pub fn with_type(
        _env: &Env,
        client: &ScavengerContractClient<'_>,
        owner: &Address,
        waste_type: WasteType,
        weight: u128,
    ) -> u128 {
        client.recycle_waste(&waste_type, &weight, owner, &0i128, &0i128)
    }

    /// Submit waste at a specific geographic location.
    pub fn with_location(
        _env: &Env,
        client: &ScavengerContractClient<'_>,
        owner: &Address,
        waste_type: WasteType,
        weight: u128,
        lat: i128,
        lon: i128,
    ) -> u128 {
        client.recycle_waste(&waste_type, &weight, owner, &lat, &lon)
    }
}

// ── IncentiveFactory ──────────────────────────────────────────────────────────

/// Factory for incentives.
pub struct IncentiveFactory;

impl IncentiveFactory {
    /// Create a Plastic incentive (100 reward, 1 000 budget) and return the incentive ID.
    pub fn plastic(_env: &Env, client: &ScavengerContractClient<'_>, manufacturer: &Address) -> u64 {
        Self::with_params(_env, client, manufacturer, WasteType::Plastic, 100, 1_000)
    }

    /// Create a Metal incentive (200 reward, 2 000 budget) and return the incentive ID.
    pub fn metal(_env: &Env, client: &ScavengerContractClient<'_>, manufacturer: &Address) -> u64 {
        Self::with_params(_env, client, manufacturer, WasteType::Metal, 200, 2_000)
    }

    /// Create an incentive with fully custom parameters; returns the incentive ID.
    pub fn with_params(
        _env: &Env,
        client: &ScavengerContractClient<'_>,
        manufacturer: &Address,
        waste_type: WasteType,
        reward: u64,
        budget: u64,
    ) -> u64 {
        client.create_incentive(manufacturer, &waste_type, &reward, &budget).id
    }
}

// ── TransferFactory ───────────────────────────────────────────────────────────

/// Factory for waste transfers.
pub struct TransferFactory;

impl TransferFactory {
    /// Transfer `waste_id` from `from` → `to` at (0, 0).
    /// The soroban test client panics on contract errors automatically.
    pub fn transfer(client: &ScavengerContractClient<'_>, waste_id: u128, from: &Address, to: &Address) {
        client.transfer_waste_v2(&waste_id, from, to, &0i128, &0i128);
    }

    /// Transfer with an explicit location.
    pub fn transfer_at(
        client: &ScavengerContractClient<'_>,
        waste_id: u128,
        from: &Address,
        to: &Address,
        lat: i128,
        lon: i128,
    ) {
        client.transfer_waste_v2(&waste_id, from, to, &lat, &lon);
    }
}
