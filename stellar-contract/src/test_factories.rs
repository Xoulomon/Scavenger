#![cfg(test)]

use crate::{Participant, ParticipantRole, WasteTransfer, Incentive, WasteType, Material};
use soroban_sdk::{Address, Env, Symbol, symbol_short};

/// Default values for test data
pub mod defaults {
    pub const DEFAULT_NAME: &str = "Test User";
    pub const DEFAULT_LATITUDE: i128 = 0;
    pub const DEFAULT_LONGITUDE: i128 = 0;
    pub const DEFAULT_REPUTATION: i128 = 100;
    pub const DEFAULT_TOKENS_EARNED: u128 = 0;
    pub const DEFAULT_WASTE_PROCESSED: u128 = 0;
}

/// Builder for creating test Participant instances
pub struct ParticipantBuilder {
    address: Address,
    role: ParticipantRole,
    name: Symbol,
    latitude: i128,
    longitude: i128,
    is_registered: bool,
    total_waste_processed: u128,
    total_tokens_earned: u128,
    registered_at: u64,
    reputation_score: i128,
    last_active_at: u64,
}

impl ParticipantBuilder {
    /// Create a new ParticipantBuilder with sensible defaults
    pub fn new(env: &Env) -> Self {
        let default_address = Address::random(env);
        let default_timestamp = env.ledger().timestamp();

        ParticipantBuilder {
            address: default_address,
            role: ParticipantRole::Recycler,
            name: symbol_short!("test"),
            latitude: defaults::DEFAULT_LATITUDE,
            longitude: defaults::DEFAULT_LONGITUDE,
            is_registered: true,
            total_waste_processed: defaults::DEFAULT_WASTE_PROCESSED,
            total_tokens_earned: defaults::DEFAULT_TOKENS_EARNED,
            registered_at: default_timestamp,
            reputation_score: defaults::DEFAULT_REPUTATION,
            last_active_at: default_timestamp,
        }
    }

    /// Override the address
    pub fn address(mut self, address: Address) -> Self {
        self.address = address;
        self
    }

    /// Override the role
    pub fn role(mut self, role: ParticipantRole) -> Self {
        self.role = role;
        self
    }

    /// Override the name
    pub fn name(mut self, name: Symbol) -> Self {
        self.name = name;
        self
    }

    /// Override the latitude (in microdegrees)
    pub fn latitude(mut self, latitude: i128) -> Self {
        self.latitude = latitude;
        self
    }

    /// Override the longitude (in microdegrees)
    pub fn longitude(mut self, longitude: i128) -> Self {
        self.longitude = longitude;
        self
    }

    /// Override the registration status
    pub fn is_registered(mut self, is_registered: bool) -> Self {
        self.is_registered = is_registered;
        self
    }

    /// Override total waste processed
    pub fn total_waste_processed(mut self, amount: u128) -> Self {
        self.total_waste_processed = amount;
        self
    }

    /// Override total tokens earned
    pub fn total_tokens_earned(mut self, amount: u128) -> Self {
        self.total_tokens_earned = amount;
        self
    }

    /// Override reputation score
    pub fn reputation_score(mut self, score: i128) -> Self {
        self.reputation_score = score;
        self
    }

    /// Build the Participant
    pub fn build(self) -> Participant {
        Participant {
            address: self.address,
            role: self.role,
            name: self.name,
            latitude: self.latitude,
            longitude: self.longitude,
            is_registered: self.is_registered,
            total_waste_processed: self.total_waste_processed,
            total_tokens_earned: self.total_tokens_earned,
            registered_at: self.registered_at,
            reputation_score: self.reputation_score,
            last_active_at: self.last_active_at,
        }
    }
}

/// Builder for creating test Material (waste) instances
pub struct MaterialBuilder {
    waste_id: u64,
    waste_type: WasteType,
    weight: u64,
    submitted_by: Address,
    verified: bool,
    submitted_at: u64,
    material_hash: Symbol,
}

impl MaterialBuilder {
    /// Create a new MaterialBuilder with sensible defaults
    pub fn new(env: &Env) -> Self {
        let default_address = Address::random(env);
        let default_timestamp = env.ledger().timestamp();

        MaterialBuilder {
            waste_id: 1,
            waste_type: WasteType::Plastic,
            weight: 100,
            submitted_by: default_address,
            verified: false,
            submitted_at: default_timestamp,
            material_hash: symbol_short!("hash"),
        }
    }

    /// Override the waste ID
    pub fn waste_id(mut self, waste_id: u64) -> Self {
        self.waste_id = waste_id;
        self
    }

    /// Override the waste type
    pub fn waste_type(mut self, waste_type: WasteType) -> Self {
        self.waste_type = waste_type;
        self
    }

    /// Override the weight (in grams)
    pub fn weight(mut self, weight: u64) -> Self {
        self.weight = weight;
        self
    }

    /// Override who submitted the material
    pub fn submitted_by(mut self, address: Address) -> Self {
        self.submitted_by = address;
        self
    }

    /// Override the verified status
    pub fn verified(mut self, verified: bool) -> Self {
        self.verified = verified;
        self
    }

    /// Build the Material
    pub fn build(self) -> Material {
        Material {
            waste_id: self.waste_id,
            waste_type: self.waste_type,
            weight: self.weight,
            submitted_by: self.submitted_by,
            verified: self.verified,
            submitted_at: self.submitted_at,
            material_hash: self.material_hash,
        }
    }
}

/// Builder for creating test Incentive instances
pub struct IncentiveBuilder {
    incentive_id: u64,
    rewarder: Address,
    waste_type: WasteType,
    initial_reward: u64,
    total_weight_reward: u128,
    total_weight_rewarded: u128,
    is_active: bool,
    start_time: u64,
    end_time: u64,
}

impl IncentiveBuilder {
    /// Create a new IncentiveBuilder with sensible defaults
    pub fn new(env: &Env) -> Self {
        let default_address = Address::random(env);
        let default_timestamp = env.ledger().timestamp();

        IncentiveBuilder {
            incentive_id: 1,
            rewarder: default_address,
            waste_type: WasteType::Plastic,
            initial_reward: 50,
            total_weight_reward: 1000,
            total_weight_rewarded: 0,
            is_active: true,
            start_time: default_timestamp,
            end_time: default_timestamp + 86400 * 30, // 30 days from now
        }
    }

    /// Override the incentive ID
    pub fn incentive_id(mut self, id: u64) -> Self {
        self.incentive_id = id;
        self
    }

    /// Override the rewarder address
    pub fn rewarder(mut self, address: Address) -> Self {
        self.rewarder = address;
        self
    }

    /// Override the waste type
    pub fn waste_type(mut self, waste_type: WasteType) -> Self {
        self.waste_type = waste_type;
        self
    }

    /// Override the initial reward amount
    pub fn initial_reward(mut self, reward: u64) -> Self {
        self.initial_reward = reward;
        self
    }

    /// Override the is_active status
    pub fn is_active(mut self, active: bool) -> Self {
        self.is_active = active;
        self
    }

    /// Override the start time
    pub fn start_time(mut self, time: u64) -> Self {
        self.start_time = time;
        self
    }

    /// Override the end time
    pub fn end_time(mut self, time: u64) -> Self {
        self.end_time = time;
        self
    }

    /// Build the Incentive
    pub fn build(self) -> Incentive {
        Incentive {
            incentive_id: self.incentive_id,
            rewarder: self.rewarder,
            waste_type: self.waste_type,
            initial_reward: self.initial_reward,
            total_weight_reward: self.total_weight_reward,
            total_weight_rewarded: self.total_weight_rewarded,
            is_active: self.is_active,
            start_time: self.start_time,
            end_time: self.end_time,
        }
    }
}

/// Builder for creating test WasteTransfer instances
pub struct WasteTransferBuilder {
    waste_id: u64,
    from: Address,
    to: Address,
    transfer_time: u64,
    transfer_type: Symbol,
}

impl WasteTransferBuilder {
    /// Create a new WasteTransferBuilder with sensible defaults
    pub fn new(env: &Env) -> Self {
        let default_from = Address::random(env);
        let default_to = Address::random(env);
        let default_timestamp = env.ledger().timestamp();

        WasteTransferBuilder {
            waste_id: 1,
            from: default_from,
            to: default_to,
            transfer_time: default_timestamp,
            transfer_type: symbol_short!("transport"),
        }
    }

    /// Override the waste ID
    pub fn waste_id(mut self, waste_id: u64) -> Self {
        self.waste_id = waste_id;
        self
    }

    /// Override the from address
    pub fn from(mut self, address: Address) -> Self {
        self.from = address;
        self
    }

    /// Override the to address
    pub fn to(mut self, address: Address) -> Self {
        self.to = address;
        self
    }

    /// Override the transfer type
    pub fn transfer_type(mut self, transfer_type: Symbol) -> Self {
        self.transfer_type = transfer_type;
        self
    }

    /// Build the WasteTransfer
    pub fn build(self) -> WasteTransfer {
        WasteTransfer {
            waste_id: self.waste_id,
            from: self.from,
            to: self.to,
            transfer_time: self.transfer_time,
            transfer_type: self.transfer_type,
        }
    }
}

#[cfg(test)]
mod factory_tests {
    use super::*;

    #[test]
    fn test_participant_factory_defaults() {
        let env = Env::default();
        let participant = ParticipantBuilder::new(&env).build();

        assert_eq!(participant.role, ParticipantRole::Recycler);
        assert_eq!(participant.reputation_score, defaults::DEFAULT_REPUTATION);
        assert_eq!(participant.is_registered, true);
        assert_eq!(participant.latitude, defaults::DEFAULT_LATITUDE);
        assert_eq!(participant.longitude, defaults::DEFAULT_LONGITUDE);
    }

    #[test]
    fn test_participant_factory_overrides() {
        let env = Env::default();
        let custom_address = Address::random(&env);
        
        let participant = ParticipantBuilder::new(&env)
            .address(custom_address.clone())
            .role(ParticipantRole::Manufacturer)
            .reputation_score(500)
            .total_tokens_earned(1000)
            .build();

        assert_eq!(participant.address, custom_address);
        assert_eq!(participant.role, ParticipantRole::Manufacturer);
        assert_eq!(participant.reputation_score, 500);
        assert_eq!(participant.total_tokens_earned, 1000);
    }

    #[test]
    fn test_material_factory_defaults() {
        let env = Env::default();
        let material = MaterialBuilder::new(&env).build();

        assert_eq!(material.waste_type, WasteType::Plastic);
        assert_eq!(material.weight, 100);
        assert_eq!(material.verified, false);
    }

    #[test]
    fn test_material_factory_overrides() {
        let env = Env::default();
        let material = MaterialBuilder::new(&env)
            .waste_type(WasteType::Glass)
            .weight(500)
            .verified(true)
            .build();

        assert_eq!(material.waste_type, WasteType::Glass);
        assert_eq!(material.weight, 500);
        assert_eq!(material.verified, true);
    }

    #[test]
    fn test_incentive_factory_defaults() {
        let env = Env::default();
        let incentive = IncentiveBuilder::new(&env).build();

        assert_eq!(incentive.waste_type, WasteType::Plastic);
        assert_eq!(incentive.initial_reward, 50);
        assert_eq!(incentive.is_active, true);
    }

    #[test]
    fn test_incentive_factory_overrides() {
        let env = Env::default();
        let incentive = IncentiveBuilder::new(&env)
            .waste_type(WasteType::Metal)
            .initial_reward(100)
            .is_active(false)
            .build();

        assert_eq!(incentive.waste_type, WasteType::Metal);
        assert_eq!(incentive.initial_reward, 100);
        assert_eq!(incentive.is_active, false);
    }

    #[test]
    fn test_waste_transfer_factory_defaults() {
        let env = Env::default();
        let transfer = WasteTransferBuilder::new(&env).build();

        assert_eq!(transfer.waste_id, 1);
        assert!(transfer.from != transfer.to); // Addresses should be different
    }

    #[test]
    fn test_waste_transfer_factory_overrides() {
        let env = Env::default();
        let from = Address::random(&env);
        let to = Address::random(&env);
        
        let transfer = WasteTransferBuilder::new(&env)
            .from(from.clone())
            .to(to.clone())
            .waste_id(42)
            .build();

        assert_eq!(transfer.from, from);
        assert_eq!(transfer.to, to);
        assert_eq!(transfer.waste_id, 42);
    }
}
