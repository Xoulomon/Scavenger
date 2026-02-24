use soroban_sdk::{contracttype, Address, String};

/// Participant role in the scavenger system
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Recycler,
    Collector,
    Manufacturer,
}

impl Role {
    /// Check if role can manufacture products
    pub fn can_manufacture(&self) -> bool {
        matches!(self, Role::Manufacturer)
    }
}

/// Waste type in the recycling system
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WasteType {
    Paper = 0,
    PetPlastic = 1,
    Plastic = 2,
    Metal = 3,
    Glass = 4,
}

/// Participant information
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Participant {
    pub address: Address,
    pub role: Role,
    pub name: String,
    pub latitude: i64,
    pub longitude: i64,
    pub registered_at: u64,
}

/// Incentive program created by manufacturers
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Incentive {
    /// Unique identifier for the incentive
    pub id: u64,
    /// Address of the manufacturer offering the incentive
    pub rewarder: Address,
    /// Type of waste this incentive targets
    pub waste_type: WasteType,
    /// Reward points per kilogram
    pub reward_points: u64,
    /// Total points budget allocated for this incentive
    pub total_budget: u64,
    /// Remaining points budget available
    pub remaining_budget: u64,
    /// Whether the incentive is currently active
    pub active: bool,
    /// Timestamp when the incentive was created
    pub created_at: u64,
}

impl Incentive {
    /// Creates a new Incentive instance
    pub fn new(
        id: u64,
        rewarder: Address,
        waste_type: WasteType,
        reward_points: u64,
        total_budget: u64,
        created_at: u64,
    ) -> Self {
        Self {
            id,
            rewarder,
            waste_type,
            reward_points,
            total_budget,
            remaining_budget: total_budget,
            active: true,
            created_at,
        }
    }
}
